// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TreasuryVault
 * @notice Holds protocol USDC fees and optional yield allocations.
 * @dev Arc ecosystem lending integrations are intentionally behind owner-set
 *      strategy hooks because Arc Testnet deployments can change.
 */
contract TreasuryVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public protocolTreasury;
    address public yieldStrategy;

    uint256 public lpYieldShareBps = 7000;
    uint256 public protocolYieldShareBps = 3000;
    mapping(address => uint256) public lpYieldCredits;

    event ProtocolTreasuryUpdated(address indexed treasury);
    event YieldStrategyUpdated(address indexed strategy);
    event FeesDeposited(address indexed from, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);
    event YieldRecorded(uint256 totalYield, uint256 lpShare, uint256 protocolShare);
    event LpYieldClaimed(address indexed provider, uint256 amount);

    constructor(address _usdc, address _protocolTreasury) Ownable(msg.sender) {
        require(_usdc != address(0) && _protocolTreasury != address(0), "TV: zero address");
        usdc = IERC20(_usdc);
        protocolTreasury = _protocolTreasury;
    }

    function setProtocolTreasury(address treasury) external onlyOwner {
        require(treasury != address(0), "TV: zero treasury");
        protocolTreasury = treasury;
        emit ProtocolTreasuryUpdated(treasury);
    }

    function setYieldStrategy(address strategy) external onlyOwner {
        yieldStrategy = strategy;
        emit YieldStrategyUpdated(strategy);
    }

    function setYieldSplit(uint256 lpBps, uint256 protocolBps) external onlyOwner {
        require(lpBps + protocolBps == 10_000, "TV: bad split");
        lpYieldShareBps = lpBps;
        protocolYieldShareBps = protocolBps;
    }

    function depositFees(uint256 amount) external nonReentrant {
        require(amount > 0, "TV: zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit FeesDeposited(msg.sender, amount);
    }

    function recordYield(address[] calldata lpProviders, uint256[] calldata weights, uint256 totalYield)
        external
        onlyOwner
        nonReentrant
    {
        require(lpProviders.length == weights.length, "TV: length mismatch");
        uint256 lpShare = (totalYield * lpYieldShareBps) / 10_000;
        uint256 protocolShare = totalYield - lpShare;
        uint256 totalWeight;
        for (uint256 i; i < weights.length; ++i) totalWeight += weights[i];
        if (totalWeight > 0) {
            for (uint256 i; i < lpProviders.length; ++i) {
                lpYieldCredits[lpProviders[i]] += (lpShare * weights[i]) / totalWeight;
            }
        }
        if (protocolShare > 0) {
            usdc.safeTransfer(protocolTreasury, protocolShare);
        }
        emit YieldRecorded(totalYield, lpShare, protocolShare);
    }

    function claimLpYield() external nonReentrant {
        uint256 amount = lpYieldCredits[msg.sender];
        require(amount > 0, "TV: no yield");
        lpYieldCredits[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit LpYieldClaimed(msg.sender, amount);
    }

    function withdrawProtocolFees(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "TV: zero amount");
        usdc.safeTransfer(protocolTreasury, amount);
        emit ProtocolFeesWithdrawn(protocolTreasury, amount);
    }
}
