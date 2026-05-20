// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CPMM
 * @notice Constant product AMM for complete-set conditional tokens.
 */
contract CPMM is ERC1155Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant ONE = 1_000_000;
    uint256 public constant FEE_BPS = 50;
    uint256 public constant LP_FEE_BPS = 30;
    uint256 public constant TREASURY_FEE_BPS = 20;

    IERC20 public immutable usdc;
    IConditionalTokenCPMM public immutable conditionalToken;
    address public immutable marketFactory;

    struct Pool {
        bool initialized;
        uint256 outcomeCount;
        uint256 totalLpShares;
        uint256 treasuryFeesAccrued;
        mapping(uint256 => uint256) reserves;
        mapping(address => uint256) lpShares;
    }

    mapping(uint256 => Pool) private pools;

    event PoolInitialized(uint256 indexed marketId, uint256 outcomeCount);
    event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 usdcAmount, uint256 lpShares);
    event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 usdcAmount, uint256 lpShares);
    event OutcomeBought(uint256 indexed marketId, uint256 indexed outcomeIndex, address indexed trader, uint256 usdcIn, uint256 tokensOut);
    event OutcomeSold(uint256 indexed marketId, uint256 indexed outcomeIndex, address indexed trader, uint256 tokenIn, uint256 usdcOut);
    event TreasuryFeesClaimed(uint256 indexed marketId, address indexed treasury, uint256 amount);

    constructor(address _usdc, address _conditionalToken, address _marketFactory) Ownable(msg.sender) {
        require(_usdc != address(0) && _conditionalToken != address(0) && _marketFactory != address(0), "CPMM: zero address");
        usdc = IERC20(_usdc);
        conditionalToken = IConditionalTokenCPMM(_conditionalToken);
        marketFactory = _marketFactory;
    }

    modifier onlyFactory() {
        require(msg.sender == marketFactory, "CPMM: not factory");
        _;
    }

    function initPool(uint256 marketId, uint256 outcomeCount) external onlyFactory {
        require(outcomeCount >= 2 && outcomeCount <= 8, "CPMM: bad outcomes");
        Pool storage p = pools[marketId];
        require(!p.initialized, "CPMM: initialized");
        p.initialized = true;
        p.outcomeCount = outcomeCount;
        emit PoolInitialized(marketId, outcomeCount);
    }

    function addLiquidity(uint256 marketId, uint256 usdcAmount) external nonReentrant returns (uint256 shares) {
        Pool storage p = pools[marketId];
        require(p.initialized, "CPMM: pool not found");
        require(usdcAmount > 0, "CPMM: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        usdc.forceApprove(address(conditionalToken), usdcAmount);
        conditionalToken.split(marketId, usdcAmount);

        if (p.totalLpShares == 0) {
            shares = usdcAmount;
        } else {
            shares = (usdcAmount * p.totalLpShares) / p.reserves[0];
        }
        require(shares > 0, "CPMM: zero shares");
        p.totalLpShares += shares;
        p.lpShares[msg.sender] += shares;

        for (uint256 i; i < p.outcomeCount; ++i) {
            p.reserves[i] += usdcAmount;
        }

        emit LiquidityAdded(marketId, msg.sender, usdcAmount, shares);
    }

    function removeLiquidity(uint256 marketId, uint256 lpShares) external nonReentrant returns (uint256 usdcOut) {
        Pool storage p = pools[marketId];
        require(p.initialized, "CPMM: pool not found");
        require(lpShares > 0 && p.lpShares[msg.sender] >= lpShares, "CPMM: bad shares");

        usdcOut = (p.reserves[0] * lpShares) / p.totalLpShares;
        require(usdcOut > 0, "CPMM: zero out");

        p.lpShares[msg.sender] -= lpShares;
        p.totalLpShares -= lpShares;
        for (uint256 i; i < p.outcomeCount; ++i) {
            p.reserves[i] -= usdcOut;
        }

        conditionalToken.merge(marketId, usdcOut);
        usdc.safeTransfer(msg.sender, usdcOut);
        emit LiquidityRemoved(marketId, msg.sender, usdcOut, lpShares);
    }

    function buyOutcome(uint256 marketId, uint256 outcomeIndex, uint256 usdcIn, uint256 minOut)
        external
        nonReentrant
        returns (uint256 tokensOut)
    {
        Pool storage p = pools[marketId];
        require(p.initialized, "CPMM: pool not found");
        require(outcomeIndex < p.outcomeCount, "CPMM: bad outcome");
        require(usdcIn > 0, "CPMM: zero input");

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        uint256 treasuryFee = (usdcIn * TREASURY_FEE_BPS) / 10_000;
        uint256 netIn = usdcIn - ((usdcIn * FEE_BPS) / 10_000);
        p.treasuryFeesAccrued += treasuryFee;

        uint256 oldK = _binaryK(p);
        usdc.forceApprove(address(conditionalToken), netIn);
        conditionalToken.split(marketId, netIn);
        for (uint256 i; i < p.outcomeCount; ++i) {
            p.reserves[i] += netIn;
        }

        if (p.outcomeCount == 2) {
            uint256 other = outcomeIndex == 0 ? 1 : 0;
            uint256 newOutcomeReserve = oldK / p.reserves[other];
            tokensOut = p.reserves[outcomeIndex] - newOutcomeReserve;
        } else {
            tokensOut = (p.reserves[outcomeIndex] * netIn) / (p.reserves[outcomeIndex] + netIn);
        }
        require(tokensOut >= minOut && tokensOut > 0, "CPMM: slippage");
        p.reserves[outcomeIndex] -= tokensOut;
        conditionalToken.safeTransferFrom(address(this), msg.sender, conditionalToken.tokenId(marketId, outcomeIndex), tokensOut, "");

        emit OutcomeBought(marketId, outcomeIndex, msg.sender, usdcIn, tokensOut);
    }

    function sellOutcome(uint256 marketId, uint256 outcomeIndex, uint256 tokenIn, uint256 minUsdcOut)
        external
        nonReentrant
        returns (uint256 usdcOut)
    {
        Pool storage p = pools[marketId];
        require(p.initialized, "CPMM: pool not found");
        require(p.outcomeCount == 2, "CPMM: sell supports binary");
        require(outcomeIndex < p.outcomeCount, "CPMM: bad outcome");
        require(tokenIn > 0, "CPMM: zero input");

        uint256 token = conditionalToken.tokenId(marketId, outcomeIndex);
        conditionalToken.safeTransferFrom(msg.sender, address(this), token, tokenIn, "");

        uint256 other = outcomeIndex == 0 ? 1 : 0;
        uint256 oldK = _binaryK(p);
        p.reserves[outcomeIndex] += tokenIn;
        uint256 newOtherReserve = oldK / p.reserves[outcomeIndex];
        uint256 grossOut = p.reserves[other] - newOtherReserve;
        uint256 fee = (grossOut * FEE_BPS) / 10_000;
        uint256 treasuryFee = (grossOut * TREASURY_FEE_BPS) / 10_000;
        usdcOut = grossOut - fee;
        require(usdcOut >= minUsdcOut && usdcOut > 0, "CPMM: slippage");

        p.reserves[other] -= grossOut;
        p.reserves[outcomeIndex] -= grossOut;
        p.treasuryFeesAccrued += treasuryFee;
        conditionalToken.merge(marketId, grossOut);
        usdc.safeTransfer(msg.sender, usdcOut);

        emit OutcomeSold(marketId, outcomeIndex, msg.sender, tokenIn, usdcOut);
    }

    function claimTreasuryFees(uint256 marketId) external nonReentrant {
        Pool storage p = pools[marketId];
        uint256 amount = p.treasuryFeesAccrued;
        require(amount > 0, "CPMM: no fees");
        p.treasuryFeesAccrued = 0;
        address treasury = IMarketFactoryCPMM(marketFactory).treasuryVault();
        usdc.safeTransfer(treasury, amount);
        emit TreasuryFeesClaimed(marketId, treasury, amount);
    }

    function getPrice(uint256 marketId, uint256 outcomeIndex) external view returns (uint256) {
        Pool storage p = pools[marketId];
        require(p.initialized, "CPMM: pool not found");
        require(outcomeIndex < p.outcomeCount, "CPMM: bad outcome");
        if (p.outcomeCount == 2) {
            uint256 other = outcomeIndex == 0 ? 1 : 0;
            uint256 sum = p.reserves[outcomeIndex] + p.reserves[other];
            return sum == 0 ? ONE / 2 : (p.reserves[other] * ONE) / sum;
        }
        uint256 total;
        for (uint256 i; i < p.outcomeCount; ++i) total += p.reserves[i];
        return total == 0 ? ONE / p.outcomeCount : ((total - p.reserves[outcomeIndex]) * ONE) / ((p.outcomeCount - 1) * total);
    }

    function getReserves(uint256 marketId) external view returns (uint256[] memory reserves) {
        Pool storage p = pools[marketId];
        reserves = new uint256[](p.outcomeCount);
        for (uint256 i; i < p.outcomeCount; ++i) {
            reserves[i] = p.reserves[i];
        }
    }

    function lpBalanceOf(uint256 marketId, address provider) external view returns (uint256) {
        return pools[marketId].lpShares[provider];
    }

    function _binaryK(Pool storage p) private view returns (uint256) {
        require(p.outcomeCount == 2, "CPMM: binary only");
        return p.reserves[0] * p.reserves[1];
    }
}

interface IConditionalTokenCPMM {
    function split(uint256 marketId, uint256 amount) external;
    function merge(uint256 marketId, uint256 amount) external;
    function tokenId(uint256 marketId, uint256 outcomeIndex) external pure returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
}

interface IMarketFactoryCPMM {
    function treasuryVault() external view returns (address);
}
