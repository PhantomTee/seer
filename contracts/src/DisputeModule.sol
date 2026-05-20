// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisputeModule
 * @notice 5-of-9 arbitrator voting module for optimistic resolution disputes.
 */
contract DisputeModule is Ownable, ReentrancyGuard {
    uint256 public constant MAX_ARBITRATORS = 9;
    uint256 public quorum = 5;
    uint256 public votingWindow = 72 hours;
    address public oracleResolver;

    struct Dispute {
        uint256 marketId;
        address proposer;
        address challenger;
        uint256 proposedOutcome;
        uint256 counterOutcome;
        uint256 openedAt;
        bool finalized;
        mapping(uint256 => uint256) votesByOutcome;
        mapping(address => bool) hasVoted;
    }

    mapping(address => bool) public isArbitrator;
    address[] public arbitrators;
    mapping(uint256 => Dispute) private disputes;

    event OracleResolverSet(address indexed resolver);
    event ArbitratorsUpdated(address[] arbitrators);
    event DisputeOpened(uint256 indexed marketId, address indexed proposer, address indexed challenger, uint256 proposedOutcome, uint256 counterOutcome);
    event VoteCast(uint256 indexed marketId, address indexed arbitrator, uint256 outcome, uint256 votes);
    event DisputeFinalized(uint256 indexed marketId, uint256 outcome, address indexed winner, address indexed loser);

    constructor(address initialArbitrator) Ownable(msg.sender) {
        require(initialArbitrator != address(0), "DM: zero arbitrator");
        isArbitrator[initialArbitrator] = true;
        arbitrators.push(initialArbitrator);
    }

    modifier onlyResolver() {
        require(msg.sender == oracleResolver, "DM: not resolver");
        _;
    }

    modifier onlyArbitrator() {
        require(isArbitrator[msg.sender], "DM: not arbitrator");
        _;
    }

    function setOracleResolver(address resolver) external onlyOwner {
        require(resolver != address(0), "DM: zero resolver");
        oracleResolver = resolver;
        emit OracleResolverSet(resolver);
    }

    function setArbitrators(address[] calldata nextArbitrators) external onlyOwner {
        require(nextArbitrators.length > 0 && nextArbitrators.length <= MAX_ARBITRATORS, "DM: bad count");
        for (uint256 i; i < arbitrators.length; ++i) {
            isArbitrator[arbitrators[i]] = false;
        }
        delete arbitrators;
        for (uint256 i; i < nextArbitrators.length; ++i) {
            require(nextArbitrators[i] != address(0), "DM: zero arbitrator");
            require(!isArbitrator[nextArbitrators[i]], "DM: duplicate");
            isArbitrator[nextArbitrators[i]] = true;
            arbitrators.push(nextArbitrators[i]);
        }
        quorum = nextArbitrators.length < 5 ? nextArbitrators.length : 5;
        emit ArbitratorsUpdated(nextArbitrators);
    }

    function setVotingWindow(uint256 window) external onlyOwner {
        require(window >= 1 hours && window <= 7 days, "DM: bad window");
        votingWindow = window;
    }

    function openDispute(uint256 marketId, address proposer, address challenger, uint256 proposedOutcome, uint256 counterOutcome)
        external
        onlyResolver
    {
        Dispute storage d = disputes[marketId];
        require(d.openedAt == 0, "DM: exists");
        d.marketId = marketId;
        d.proposer = proposer;
        d.challenger = challenger;
        d.proposedOutcome = proposedOutcome;
        d.counterOutcome = counterOutcome;
        d.openedAt = block.timestamp;
        emit DisputeOpened(marketId, proposer, challenger, proposedOutcome, counterOutcome);
    }

    function vote(uint256 marketId, uint256 outcome) external onlyArbitrator nonReentrant {
        Dispute storage d = disputes[marketId];
        require(d.openedAt != 0, "DM: no dispute");
        require(!d.finalized, "DM: finalized");
        require(block.timestamp <= d.openedAt + votingWindow, "DM: closed");
        require(outcome == d.proposedOutcome || outcome == d.counterOutcome, "DM: invalid outcome");
        require(!d.hasVoted[msg.sender], "DM: voted");

        d.hasVoted[msg.sender] = true;
        d.votesByOutcome[outcome] += 1;
        emit VoteCast(marketId, msg.sender, outcome, d.votesByOutcome[outcome]);
        if (d.votesByOutcome[outcome] >= quorum) {
            _finalize(d, outcome);
        }
    }

    function finalizeExpired(uint256 marketId) external nonReentrant {
        Dispute storage d = disputes[marketId];
        require(d.openedAt != 0, "DM: no dispute");
        require(!d.finalized, "DM: finalized");
        require(block.timestamp > d.openedAt + votingWindow, "DM: still open");
        uint256 outcome = d.votesByOutcome[d.counterOutcome] > d.votesByOutcome[d.proposedOutcome]
            ? d.counterOutcome
            : d.proposedOutcome;
        _finalize(d, outcome);
    }

    function getVotes(uint256 marketId, uint256 outcome) external view returns (uint256) {
        return disputes[marketId].votesByOutcome[outcome];
    }

    function getArbitrators() external view returns (address[] memory) {
        return arbitrators;
    }

    function _finalize(Dispute storage d, uint256 outcome) internal {
        d.finalized = true;
        address winner = outcome == d.proposedOutcome ? d.proposer : d.challenger;
        address loser = outcome == d.proposedOutcome ? d.challenger : d.proposer;
        IOracleResolverDispute(oracleResolver).finalizeDispute(d.marketId, outcome, winner, loser);
        emit DisputeFinalized(d.marketId, outcome, winner, loser);
    }
}

interface IOracleResolverDispute {
    function finalizeDispute(uint256 marketId, uint256 outcome, address winner, address loser) external;
}
