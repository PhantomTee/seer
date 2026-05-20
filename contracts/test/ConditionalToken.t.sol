// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract ConditionalTokenTest is ArcPredictTestBase {
    function testSplitAndRedeemWinningTokens() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.ADMIN);
        _split(bob, marketId, 100 * USDC);

        uint256 yesId = ct.tokenId(marketId, 0);
        assertEq(ct.balanceOf(bob, yesId), 100 * USDC);

        vm.warp(block.timestamp + 3 hours);
        resolver.resolveAdmin(marketId, 0);

        vm.prank(bob);
        ct.redeem(marketId, 25 * USDC);
        assertEq(usdc.balanceOf(bob), 19_925 * USDC);
    }

    function testCannotDoubleResolve() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.ADMIN);
        vm.warp(block.timestamp + 3 hours);
        resolver.resolveAdmin(marketId, 0);
        vm.expectRevert();
        resolver.resolveAdmin(marketId, 1);
    }

    function testCannotSplitZeroAmount() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.ADMIN);
        vm.startPrank(bob);
        vm.expectRevert("CT: zero amount");
        ct.split(marketId, 0);
        vm.stopPrank();
    }
}
