// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract OracleResolverTest is ArcPredictTestBase {
    function testChainlinkResolution() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.CHAINLINK);
        vm.warp(block.timestamp + 3 hours);
        feed.setAnswer(100_000e8);
        resolver.triggerChainlinkResolution(marketId);
        assertEq(ct.resolution(marketId), 0);
    }

    function testOptimisticProposalSettlesAfterWindow() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.warp(block.timestamp + 3 hours);
        vm.startPrank(bob);
        usdc.approve(address(resolver), 500 * USDC);
        resolver.proposeOutcome(marketId, 1);
        vm.stopPrank();

        vm.warp(block.timestamp + 49 hours);
        resolver.settleUndisputed(marketId);
        assertEq(ct.resolution(marketId), 1);
    }

    function testWrongOracleModeRejected() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.warp(block.timestamp + 3 hours);
        vm.expectRevert("OR: wrong mode");
        resolver.triggerChainlinkResolution(marketId);
    }

    function testRejectsNegativeChainlinkAnswer() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.CHAINLINK);
        vm.warp(block.timestamp + 3 hours);
        feed.setAnswer(-1);
        vm.expectRevert("OR: bad answer");
        resolver.triggerChainlinkResolution(marketId);
    }
}
