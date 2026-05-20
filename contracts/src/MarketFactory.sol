// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MarketFactory
 * @notice Permissionless market creation with a USDC anti-spam creation bond.
 */
contract MarketFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OracleMode {
        CHAINLINK,
        OPTIMISTIC,
        ADMIN
    }
    enum MarketType {
        BINARY,
        CATEGORICAL
    }
    enum MarketState {
        OPEN,
        RESOLVING,
        RESOLVED,
        INVALID
    }

    struct Market {
        uint256 id;
        address creator;
        string question;
        string ipfsMetadata;
        uint256 resolutionTime;
        OracleMode oracleMode;
        MarketType marketType;
        MarketState state;
        uint256 creationBond;
        uint256 createdAt;
        address chainlinkFeed;
        uint256 chainlinkThreshold;
        bool chainlinkAbove;
        string[] outcomeLabels;
    }

    IERC20 public immutable usdc;
    address public conditionalToken;
    address public oracleResolver;
    address public cpmm;
    address public orderBook;
    address public treasuryVault;

    uint256 public nextMarketId = 1;
    uint256 public creationBond = 5e6;
    uint256 public constant MAX_OUTCOMES = 8;

    mapping(uint256 => Market) public markets;
    uint256[] public marketIds;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        OracleMode oracleMode,
        uint256 resolutionTime
    );
    event MarketStateChanged(uint256 indexed marketId, MarketState newState);
    event BondReturned(uint256 indexed marketId, address indexed creator);
    event BondSlashed(uint256 indexed marketId, address indexed creator, address indexed slashTo);
    event CoreContractsUpdated(address conditionalToken, address oracleResolver, address cpmm, address orderBook, address treasuryVault);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "MF: zero usdc");
        usdc = IERC20(_usdc);
    }

    function setConditionalToken(address _ct) external onlyOwner {
        conditionalToken = _ct;
        emit CoreContractsUpdated(conditionalToken, oracleResolver, cpmm, orderBook, treasuryVault);
    }

    function setOracleResolver(address _or) external onlyOwner {
        oracleResolver = _or;
        emit CoreContractsUpdated(conditionalToken, oracleResolver, cpmm, orderBook, treasuryVault);
    }

    function setCPMM(address _cpmm) external onlyOwner {
        cpmm = _cpmm;
        emit CoreContractsUpdated(conditionalToken, oracleResolver, cpmm, orderBook, treasuryVault);
    }

    function setOrderBook(address _ob) external onlyOwner {
        orderBook = _ob;
        emit CoreContractsUpdated(conditionalToken, oracleResolver, cpmm, orderBook, treasuryVault);
    }

    function setTreasuryVault(address _tv) external onlyOwner {
        treasuryVault = _tv;
        emit CoreContractsUpdated(conditionalToken, oracleResolver, cpmm, orderBook, treasuryVault);
    }

    function setCreationBond(uint256 _bond) external onlyOwner {
        creationBond = _bond;
    }

    function createMarket(
        string calldata question,
        string calldata ipfsMetadata,
        uint256 resolutionTime,
        OracleMode oracleMode,
        MarketType marketType,
        address chainlinkFeed,
        uint256 chainlinkThreshold,
        bool chainlinkAbove,
        string[] calldata outcomeLabels
    ) external nonReentrant returns (uint256 marketId) {
        uint256 labelCount = outcomeLabels.length;
        _validateMarketInput(question, resolutionTime, oracleMode, marketType, chainlinkFeed, labelCount);

        usdc.safeTransferFrom(msg.sender, address(this), creationBond);

        marketId = nextMarketId++;
        _storeMarket(
            marketId,
            question,
            ipfsMetadata,
            resolutionTime,
            oracleMode,
            marketType,
            chainlinkFeed,
            chainlinkThreshold,
            chainlinkAbove
        );
        _copyOutcomeLabels(marketId, outcomeLabels);
        marketIds.push(marketId);

        IConditionalToken(conditionalToken).registerMarket(marketId, labelCount);
        ICPMM(cpmm).initPool(marketId, labelCount);

        _emitMarketCreated(marketId);
    }

    function _validateMarketInput(
        string calldata question,
        uint256 resolutionTime,
        OracleMode oracleMode,
        MarketType marketType,
        address chainlinkFeed,
        uint256 labelCount
    ) internal view {
        require(conditionalToken != address(0) && cpmm != address(0), "MF: not wired");
        require(bytes(question).length > 0 && bytes(question).length <= 512, "MF: invalid question");
        require(resolutionTime > block.timestamp + 1 hours, "MF: too soon");
        require(resolutionTime < block.timestamp + 365 days, "MF: too far");
        require(labelCount >= 2 && labelCount <= MAX_OUTCOMES, "MF: bad outcomes");
        if (oracleMode == OracleMode.CHAINLINK) {
            require(chainlinkFeed != address(0), "MF: need feed address");
        }
        if (marketType == MarketType.BINARY) {
            require(labelCount == 2, "MF: binary needs 2");
        }
    }

    function _storeMarket(
        uint256 marketId,
        string calldata question,
        string calldata ipfsMetadata,
        uint256 resolutionTime,
        OracleMode oracleMode,
        MarketType marketType,
        address chainlinkFeed,
        uint256 chainlinkThreshold,
        bool chainlinkAbove
    ) internal {
        Market storage m = markets[marketId];
        m.id = marketId;
        m.creator = msg.sender;
        m.question = question;
        m.ipfsMetadata = ipfsMetadata;
        m.resolutionTime = resolutionTime;
        m.oracleMode = oracleMode;
        m.marketType = marketType;
        m.state = MarketState.OPEN;
        m.creationBond = creationBond;
        m.createdAt = block.timestamp;
        m.chainlinkFeed = chainlinkFeed;
        m.chainlinkThreshold = chainlinkThreshold;
        m.chainlinkAbove = chainlinkAbove;
    }

    function _copyOutcomeLabels(uint256 marketId, string[] calldata outcomeLabels) internal {
        Market storage m = markets[marketId];
        for (uint256 i; i < outcomeLabels.length; ++i) {
            require(bytes(outcomeLabels[i]).length > 0 && bytes(outcomeLabels[i]).length <= 64, "MF: bad label");
            m.outcomeLabels.push(outcomeLabels[i]);
        }
    }

    function _emitMarketCreated(uint256 marketId) internal {
        Market storage m = markets[marketId];
        emit MarketCreated(marketId, m.creator, m.question, m.oracleMode, m.resolutionTime);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
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
        )
    {
        Market storage m = markets[marketId];
        return (
            m.creator,
            m.resolutionTime,
            m.oracleMode,
            m.state,
            m.creationBond,
            m.chainlinkFeed,
            m.chainlinkThreshold,
            m.chainlinkAbove,
            m.outcomeLabels.length
        );
    }

    function getOutcomeLabels(uint256 marketId) external view returns (string[] memory) {
        return markets[marketId].outcomeLabels;
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        return marketIds;
    }

    function setMarketState(uint256 marketId, MarketState newState) external {
        require(msg.sender == oracleResolver, "MF: not resolver");
        require(markets[marketId].id != 0, "MF: market not found");
        markets[marketId].state = newState;
        emit MarketStateChanged(marketId, newState);
    }

    function returnBond(uint256 marketId) external {
        require(msg.sender == oracleResolver, "MF: not resolver");
        Market storage m = markets[marketId];
        require(m.state == MarketState.RESOLVED, "MF: not resolved");
        uint256 bond = m.creationBond;
        m.creationBond = 0;
        if (bond > 0) {
            usdc.safeTransfer(m.creator, bond);
        }
        emit BondReturned(marketId, m.creator);
    }

    function slashBond(uint256 marketId, address slashTo) external {
        require(msg.sender == oracleResolver, "MF: not resolver");
        Market storage m = markets[marketId];
        uint256 bond = m.creationBond;
        m.creationBond = 0;
        if (bond > 0) {
            usdc.safeTransfer(slashTo, bond);
        }
        emit BondSlashed(marketId, m.creator, slashTo);
    }
}

interface IConditionalToken {
    function registerMarket(uint256 marketId, uint256 outcomeCount) external;
}

interface ICPMM {
    function initPool(uint256 marketId, uint256 outcomeCount) external;
}
