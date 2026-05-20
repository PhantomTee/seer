// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract CPMMTest is ArcPredictTestBase {
    function testAddLiquidityAndPricesSumToOne() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);

        vm.startPrank(alice);
        usdc.approve(address(cpmm), 1_000 * USDC);
        cpmm.addLiquidity(marketId, 1_000 * USDC);
        vm.stopPrank();

        uint256 yes = cpmm.getPrice(marketId, 0);
        uint256 no = cpmm.getPrice(marketId, 1);
        assertEq(yes + no, 1_000_000);
    }

    function testBuyOutcomeMovesPrice() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.startPrank(alice);
        usdc.approve(address(cpmm), 1_000 * USDC);
        cpmm.addLiquidity(marketId, 1_000 * USDC);
        vm.stopPrank();

        uint256 beforePrice = cpmm.getPrice(marketId, 0);
        vm.startPrank(bob);
        usdc.approve(address(cpmm), 100 * USDC);
        cpmm.buyOutcome(marketId, 0, 100 * USDC, 1);
        vm.stopPrank();

        assertGt(cpmm.getPrice(marketId, 0), beforePrice);
    }

    function testRemoveLiquidityReturnsUsdc() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.startPrank(alice);
        usdc.approve(address(cpmm), 500 * USDC);
        uint256 shares = cpmm.addLiquidity(marketId, 500 * USDC);
        uint256 balanceBefore = usdc.balanceOf(alice);
        cpmm.removeLiquidity(marketId, shares / 2);
        assertGt(usdc.balanceOf(alice), balanceBefore);
        vm.stopPrank();
    }
}
