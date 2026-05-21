// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OracleResolver
 * @notice Resolves Chainlink, optimistic, and admin markets.
 */
contract OracleResolver is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OracleMode {
        CHAINLINK,
        OPTIMISTIC,
        ADMIN
    }
    enum MarketState {
        OPEN,
        RESOLVING,
        RESOLVED,
        INVALID
    }

    struct Proposal {
        address proposer;
        uint256 proposedOutcome;
        uint256 proposedAt;
        address challenger;
        uint256 counterOutcome;
        bool disputed;
        bool settled;
    }

    IMarketFactoryResolver public immutable marketFactory;
    IConditionalTokenResolver public immutable conditionalToken;
    IDisputeModuleResolver public immutable disputeModule;
    IERC20 public immutable usdc;

    uint256 public proposalBond = 5e6;
    uint256 public disputeWindow = 48 hours;
    uint256 public maxFeedStaleness = 2 days;

    mapping(uint256 => Proposal) public proposals;

    event ChainlinkResolved(uint256 indexed marketId, int256 answer, uint256 threshold, uint256 outcome);
    event OutcomeProposed(uint256 indexed marketId, address indexed proposer, uint256 outcome, uint256 deadline);
    event OutcomeDisputed(uint256 indexed marketId, address indexed challenger, uint256 counterOutcome);
    event OptimisticSettled(uint256 indexed marketId, uint256 outcome);
    event AdminResolved(uint256 indexed marketId, uint256 outcome);
    event DisputeFinalized(uint256 indexed marketId, uint256 outcome, address indexed winner, address indexed loser);

    constructor(address _factory, address _conditionalToken, address _disputeModule, address _usdc)
        Ownable(msg.sender)
    {
        require(_factory != address(0) && _conditionalToken != address(0) && _disputeModule != address(0) && _usdc != address(0), "OR: zero address");
        marketFactory = IMarketFactoryResolver(_factory);
        conditionalToken = IConditionalTokenResolver(_conditionalToken);
        disputeModule = IDisputeModuleResolver(_disputeModule);
        usdc = IERC20(_usdc);
    }

    function setProposalBond(uint256 bond) external onlyOwner {
        proposalBond = bond;
    }

    function setDisputeWindow(uint256 window) external onlyOwner {
        require(window >= 1 hours && window <= 7 days, "OR: bad window");
        disputeWindow = window;
    }

    function triggerChainlinkResolution(uint256 marketId) external nonReentrant {
        (
            ,
            uint256 resolutionTime,
            IMarketFactoryResolver.OracleMode oracleMode,
            IMarketFactoryResolver.MarketState state,
            ,
            address feed,
            uint256 threshold,
            bool above,
            uint256 outcomes
        ) = marketFactory.getMarketForResolution(marketId);

        require(oracleMode == IMarketFactoryResolver.OracleMode.CHAINLINK, "OR: wrong mode");
        require(state == IMarketFactoryResolver.MarketState.OPEN, "OR: not open");
        require(outcomes >= 2, "OR: no market");
        require(block.timestamp >= resolutionTime, "OR: too early");

        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "OR: bad answer");
        require(updatedAt != 0 && block.timestamp - updatedAt <= maxFeedStaleness, "OR: stale feed");

        uint256 unsignedAnswer = uint256(answer);
        uint256 outcome = above ? (unsignedAnswer > threshold ? 0 : 1) : (unsignedAnswer < threshold ? 0 : 1);
        _resolve(marketId, outcome);
        emit ChainlinkResolved(marketId, answer, threshold, outcome);
    }

    function proposeOutcome(uint256 marketId, uint256 outcomeIndex) external nonReentrant {
        (
            ,
            uint256 resolutionTime,
            IMarketFactoryResolver.OracleMode oracleMode,
            IMarketFactoryResolver.MarketState state,
            ,
            ,
            ,
            ,
            uint256 outcomes
        ) = marketFactory.getMarketForResolution(marketId);

        require(oracleMode == IMarketFactoryResolver.OracleMode.OPTIMISTIC, "OR: wrong mode");
        require(state == IMarketFactoryResolver.MarketState.OPEN, "OR: not open");
        require(block.timestamp >= resolutionTime, "OR: too early");
        require(outcomeIndex < outcomes, "OR: bad outcome");

        Proposal storage p = proposals[marketId];
        require(p.proposer == address(0), "OR: already proposed");
        usdc.safeTransferFrom(msg.sender, address(this), proposalBond);
        proposals[marketId] = Proposal({
            proposer: msg.sender,
            proposedOutcome: outcomeIndex,
            proposedAt: block.timestamp,
            challenger: address(0),
            counterOutcome: 0,
            disputed: false,
            settled: false
        });
        marketFactory.setMarketState(marketId, IMarketFactoryResolver.MarketState.RESOLVING);
        emit OutcomeProposed(marketId, msg.sender, outcomeIndex, block.timestamp + disputeWindow);
    }

    function disputeOutcome(uint256 marketId, uint256 counterOutcome) external nonReentrant {
        Proposal storage p = proposals[marketId];
        require(p.proposer != address(0), "OR: no proposal");
        require(!p.disputed && !p.settled, "OR: closed");
        require(block.timestamp <= p.proposedAt + disputeWindow, "OR: window closed");
        require(counterOutcome != p.proposedOutcome, "OR: same outcome");
        (, , , , , , , , uint256 outcomes) = marketFactory.getMarketForResolution(marketId);
        require(counterOutcome < outcomes, "OR: bad outcome");

        usdc.safeTransferFrom(msg.sender, address(this), proposalBond);
        p.challenger = msg.sender;
        p.counterOutcome = counterOutcome;
        p.disputed = true;

        disputeModule.openDispute(marketId, p.proposer, msg.sender, p.proposedOutcome, counterOutcome);
        emit OutcomeDisputed(marketId, msg.sender, counterOutcome);
    }

    function settleUndisputed(uint256 marketId) external nonReentrant {
        Proposal storage p = proposals[marketId];
        require(p.proposer != address(0), "OR: no proposal");
        require(!p.disputed && !p.settled, "OR: disputed/settled");
        require(block.timestamp > p.proposedAt + disputeWindow, "OR: window open");

        p.settled = true;
        _resolve(marketId, p.proposedOutcome);
        usdc.safeTransfer(p.proposer, proposalBond);
        emit OptimisticSettled(marketId, p.proposedOutcome);
    }

    function resolveAdmin(uint256 marketId, uint256 outcome) external onlyOwner nonReentrant {
        (
            ,
            uint256 resolutionTime,
            IMarketFactoryResolver.OracleMode oracleMode,
            IMarketFactoryResolver.MarketState state,
            ,
            ,
            ,
            ,
            uint256 outcomes
        ) = marketFactory.getMarketForResolution(marketId);
        require(oracleMode == IMarketFactoryResolver.OracleMode.ADMIN, "OR: wrong mode");
        require(state == IMarketFactoryResolver.MarketState.OPEN || state == IMarketFactoryResolver.MarketState.RESOLVING, "OR: closed");
        require(block.timestamp >= resolutionTime, "OR: too early");
        require(outcome < outcomes, "OR: bad outcome");
        _resolve(marketId, outcome);
        emit AdminResolved(marketId, outcome);
    }

    function finalizeDispute(uint256 marketId, uint256 outcome, address winner, address loser) external nonReentrant {
        require(msg.sender == address(disputeModule), "OR: not dispute module");
        Proposal storage p = proposals[marketId];
        require(p.disputed && !p.settled, "OR: not active");
        require((winner == p.proposer && loser == p.challenger) || (winner == p.challenger && loser == p.proposer), "OR: bad parties");
        p.settled = true;

        _resolve(marketId, outcome);
        uint256 bonus = proposalBond / 10;
        usdc.safeTransfer(winner, proposalBond + bonus);
        usdc.safeTransfer(IMarketFactoryResolver(address(marketFactory)).treasuryVault(), proposalBond - bonus);
        marketFactory.slashBond(marketId, loser);
        emit DisputeFinalized(marketId, outcome, winner, loser);
    }

    function _resolve(uint256 marketId, uint256 outcome) internal {
        conditionalToken.resolveMarket(marketId, outcome);
        marketFactory.setMarketState(marketId, IMarketFactoryResolver.MarketState.RESOLVED);
        marketFactory.returnBond(marketId);
    }
}

interface IMarketFactoryResolver {
    enum OracleMode {
        CHAINLINK,
        OPTIMISTIC,
        ADMIN
    }
    enum MarketState {
        OPEN,
        RESOLVING,
        RESOLVED,
        INVALID
    }

    function getMarketForResolution(uint256 marketId)
        external
        view
        returns (
            address creator,
            uint256 resolutionTime,
            OracleMode oracleMode,
            MarketState state,
            uint256 bond,
            address chainlinkFeed,
            uint256 chainlinkThreshold,
            bool chainlinkAbove,
            uint256 outcomes
        );

    function setMarketState(uint256 marketId, MarketState newState) external;
    function returnBond(uint256 marketId) external;
    function slashBond(uint256 marketId, address slashTo) external;
    function treasuryVault() external view returns (address);
}

interface IConditionalTokenResolver {
    function resolveMarket(uint256 marketId, uint256 winningOutcome) external;
}

interface IDisputeModuleResolver {
    function openDispute(uint256 marketId, address proposer, address challenger, uint256 proposedOutcome, uint256 counterOutcome) external;
}
