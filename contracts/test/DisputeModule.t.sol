// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract DisputeModuleTest is ArcPredictTestBase {
    function testDisputeVotesFinalizeResolution() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.warp(block.timestamp + 3 hours);

        vm.startPrank(bob);
        usdc.approve(address(resolver), 500 * USDC);
        resolver.proposeOutcome(marketId, 0);
        vm.stopPrank();

        vm.startPrank(carol);
        usdc.approve(address(resolver), 500 * USDC);
        resolver.disputeOutcome(marketId, 1);
        vm.stopPrank();

        for (uint256 i; i < arbitrators.length; ++i) {
            vm.prank(arbitrators[i]);
            dm.vote(marketId, 1);
        }

        assertEq(ct.resolution(marketId), 1);
    }

    function testNonArbitratorCannotVote() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.warp(block.timestamp + 3 hours);

        vm.startPrank(bob);
        usdc.approve(address(resolver), 500 * USDC);
        resolver.proposeOutcome(marketId, 0);
        vm.stopPrank();

        vm.startPrank(carol);
        usdc.approve(address(resolver), 500 * USDC);
        resolver.disputeOutcome(marketId, 1);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert("DM: not arbitrator");
        dm.vote(marketId, 1);
    }
}
