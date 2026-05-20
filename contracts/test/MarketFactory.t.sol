// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract MarketFactoryTest is ArcPredictTestBase {
    function testCreateMarketRegistersTokenAndPool() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.CHAINLINK);
        MarketFactory.Market memory market = factory.getMarket(marketId);

        assertEq(market.creator, alice);
        assertEq(uint256(market.oracleMode), uint256(MarketFactory.OracleMode.CHAINLINK));
        assertEq(ct.outcomeCount(marketId), 2);
        assertEq(factory.getAllMarketIds().length, 1);
    }

    function testRejectsTooSoonResolution() public {
        vm.startPrank(alice);
        usdc.approve(address(factory), 5 * USDC);
        vm.expectRevert("MF: too soon");
        factory.createMarket(
            "Too soon?",
            "ipfs://criteria",
            block.timestamp + 30 minutes,
            MarketFactory.OracleMode.OPTIMISTIC,
            MarketFactory.MarketType.BINARY,
            address(0),
            0,
            false,
            _labels()
        );
        vm.stopPrank();
    }

    function testOnlyOwnerCanSetCreationBond() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setCreationBond(10 * USDC);
        factory.setCreationBond(10 * USDC);
        assertEq(factory.creationBond(), 10 * USDC);
    }
}
