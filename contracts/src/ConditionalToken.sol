// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ConditionalToken
 * @notice ERC-1155 outcome tokens for ArcPredict markets.
 * @dev Arc USDC is native gas with 18 decimals, but the ERC-20 interface uses 6
 *      decimals. This contract only accepts ERC-20 USDC collateral.
 */
contract ConditionalToken is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public marketFactory;

    mapping(uint256 => uint256) public outcomeCount;
    mapping(uint256 => uint256) public resolution;
    mapping(uint256 => uint256) public collateralLocked;

    event Minted(address indexed user, uint256 indexed marketId, uint256 amount);
    event Merged(address indexed user, uint256 indexed marketId, uint256 amount);
    event Redeemed(address indexed user, uint256 indexed marketId, uint256 winningOutcome, uint256 amount);
    event MarketRegistered(uint256 indexed marketId, uint256 outcomeCount);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome);
    event MarketFactoryUpdated(address indexed marketFactory);

    constructor(address _usdc, address _marketFactory)
        ERC1155("https://arcpredict.io/api/tokens/{id}.json")
        Ownable(msg.sender)
    {
        require(_usdc != address(0), "CT: zero usdc");
        usdc = IERC20(_usdc);
        marketFactory = _marketFactory;
    }

    modifier onlyFactory() {
        require(msg.sender == marketFactory, "CT: not factory");
        _;
    }

    modifier onlyResolver() {
        require(msg.sender == IMarketFactory(marketFactory).oracleResolver(), "CT: not resolver");
        _;
    }

    function setMarketFactory(address _marketFactory) external onlyOwner {
        require(_marketFactory != address(0), "CT: zero factory");
        marketFactory = _marketFactory;
        emit MarketFactoryUpdated(_marketFactory);
    }

    function registerMarket(uint256 marketId, uint256 _outcomeCount) external onlyFactory {
        require(_outcomeCount >= 2, "CT: need 2+ outcomes");
        require(outcomeCount[marketId] == 0, "CT: already registered");
        outcomeCount[marketId] = _outcomeCount;
        resolution[marketId] = type(uint256).max;
        emit MarketRegistered(marketId, _outcomeCount);
    }

    function split(uint256 marketId, uint256 amount) external nonReentrant {
        require(outcomeCount[marketId] > 0, "CT: market not found");
        require(resolution[marketId] == type(uint256).max, "CT: market resolved");
        require(amount > 0, "CT: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        collateralLocked[marketId] += amount;

        uint256 n = outcomeCount[marketId];
        uint256[] memory ids = new uint256[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = tokenId(marketId, i);
            amounts[i] = amount;
        }
        _mintBatch(msg.sender, ids, amounts, "");
        emit Minted(msg.sender, marketId, amount);
    }

    /**
     * @notice Burn a complete set of outcome tokens and receive USDC back.
     * @dev This enables CPMM liquidity removal before market resolution.
     */
    function merge(uint256 marketId, uint256 amount) external nonReentrant {
        require(outcomeCount[marketId] > 0, "CT: market not found");
        require(resolution[marketId] == type(uint256).max, "CT: market resolved");
        require(amount > 0, "CT: zero amount");

        uint256 n = outcomeCount[marketId];
        uint256[] memory ids = new uint256[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = tokenId(marketId, i);
            amounts[i] = amount;
        }

        _burnBatch(msg.sender, ids, amounts);
        collateralLocked[marketId] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Merged(msg.sender, marketId, amount);
    }

    function redeem(uint256 marketId, uint256 amount) external nonReentrant {
        uint256 winningOutcome = resolution[marketId];
        require(winningOutcome != type(uint256).max, "CT: not resolved");
        require(amount > 0, "CT: zero amount");

        uint256 tid = tokenId(marketId, winningOutcome);
        _burn(msg.sender, tid, amount);
        collateralLocked[marketId] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, marketId, winningOutcome, amount);
    }

    function resolveMarket(uint256 marketId, uint256 winningOutcome) external onlyResolver {
        require(outcomeCount[marketId] > 0, "CT: market not found");
        require(resolution[marketId] == type(uint256).max, "CT: already resolved");
        require(winningOutcome < outcomeCount[marketId], "CT: invalid outcome");
        resolution[marketId] = winningOutcome;
        emit MarketResolved(marketId, winningOutcome);
    }

    function tokenId(uint256 marketId, uint256 outcomeIndex) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(marketId, outcomeIndex)));
    }

    function isResolved(uint256 marketId) public view returns (bool) {
        return resolution[marketId] != type(uint256).max;
    }
}

interface IMarketFactory {
    function oracleResolver() external view returns (address);
}
