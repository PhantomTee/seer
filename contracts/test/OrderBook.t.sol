// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArcPredictTestBase.t.sol";

contract OrderBookTest is ArcPredictTestBase {
    function testLimitOrderFullFill() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        _split(bob, marketId, 100 * USDC);
        uint256 yesId = ct.tokenId(marketId, 0);

        vm.startPrank(bob);
        ct.setApprovalForAll(address(ob), true);
        ob.placeOrder(marketId, 0, OrderBook.Side.SELL, 600_000, 50 * USDC);
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.approve(address(ob), 30 * USDC);
        ob.placeOrder(marketId, 0, OrderBook.Side.BUY, 600_000, 50 * USDC);
        vm.stopPrank();

        assertEq(ct.balanceOf(alice, yesId), 50 * USDC);
        assertGt(usdc.balanceOf(bob), 19_900 * USDC);
    }

    function testBestBidAskAndDepthAreSortedAndAggregated() public {
        uint256 bidMarketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);

        _placeBuy(alice, bidMarketId, 0, 500_000, 10 * USDC);
        _placeBuy(alice, bidMarketId, 0, 700_000, 10 * USDC);
        _placeBuy(carol, bidMarketId, 0, 600_000, 10 * USDC);
        _placeBuy(carol, bidMarketId, 0, 700_000, 5 * USDC);

        (uint256 bestBid, uint256 bestBidSize) = ob.getBestBid(bidMarketId, 0);
        assertEq(bestBid, 700_000);
        assertEq(bestBidSize, 15 * USDC);

        (uint256[] memory bidPrices, uint256[] memory bidSizes) =
            ob.getDepth(bidMarketId, 0, OrderBook.Side.BUY, 5);
        assertEq(bidPrices[0], 700_000);
        assertEq(bidSizes[0], 15 * USDC);
        assertEq(bidPrices[1], 600_000);
        assertEq(bidSizes[1], 10 * USDC);
        assertEq(bidPrices[2], 500_000);
        assertEq(bidSizes[2], 10 * USDC);
        assertEq(bidPrices[3], 0);

        uint256 askMarketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        _split(bob, askMarketId, 30 * USDC);

        _placeSell(bob, askMarketId, 0, 800_000, 5 * USDC);
        _placeSell(bob, askMarketId, 0, 650_000, 7 * USDC);
        _placeSell(bob, askMarketId, 0, 900_000, 3 * USDC);
        _placeSell(bob, askMarketId, 0, 650_000, 2 * USDC);

        (uint256 bestAsk, uint256 bestAskSize) = ob.getBestAsk(askMarketId, 0);
        assertEq(bestAsk, 650_000);
        assertEq(bestAskSize, 9 * USDC);

        (uint256[] memory askPrices, uint256[] memory askSizes) =
            ob.getDepth(askMarketId, 0, OrderBook.Side.SELL, 5);
        assertEq(askPrices[0], 650_000);
        assertEq(askSizes[0], 9 * USDC);
        assertEq(askPrices[1], 800_000);
        assertEq(askSizes[1], 5 * USDC);
        assertEq(askPrices[2], 900_000);
        assertEq(askSizes[2], 3 * USDC);
        assertEq(askPrices[3], 0);
    }

    function testPartialFillLeavesRemainderAtPriceLevel() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        _split(bob, marketId, 100 * USDC);
        uint256 yesId = ct.tokenId(marketId, 0);

        uint256 sellOrderId = _placeSell(bob, marketId, 0, 600_000, 100 * USDC);
        _placeBuy(alice, marketId, 0, 600_000, 40 * USDC);

        assertEq(ct.balanceOf(alice, yesId), 40 * USDC);
        (uint256 bestAsk, uint256 bestAskSize) = ob.getBestAsk(marketId, 0);
        assertEq(bestAsk, 600_000);
        assertEq(bestAskSize, 60 * USDC);

        (,,,,,,, uint256 filled,, bool cancelled, bool onBook) = ob.orders(sellOrderId);
        assertEq(filled, 40 * USDC);
        assertFalse(cancelled);
        assertTrue(onBook);
    }

    function testPriceTimePriorityAtSameLevel() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        _split(bob, marketId, 30 * USDC);
        _split(carol, marketId, 30 * USDC);

        uint256 bobOrderId = _placeSell(bob, marketId, 0, 600_000, 30 * USDC);
        uint256 carolOrderId = _placeSell(carol, marketId, 0, 600_000, 30 * USDC);
        _placeBuy(alice, marketId, 0, 600_000, 40 * USDC);

        (,,,,,,, uint256 bobFilled,, bool bobCancelled, bool bobOnBook) = ob.orders(bobOrderId);
        (,,,,,,, uint256 carolFilled,, bool carolCancelled, bool carolOnBook) = ob.orders(carolOrderId);
        assertEq(bobFilled, 30 * USDC);
        assertFalse(bobCancelled);
        assertFalse(bobOnBook);
        assertEq(carolFilled, 10 * USDC);
        assertFalse(carolCancelled);
        assertTrue(carolOnBook);

        (,, uint256 head, uint256 tail, uint256 aggregateSize, bool exists) =
            ob.getPriceLevel(marketId, 0, OrderBook.Side.SELL, 600_000);
        assertTrue(exists);
        assertEq(head, carolOrderId);
        assertEq(tail, carolOrderId);
        assertEq(aggregateSize, 20 * USDC);
    }

    function testCancelOrderRefundsEscrow() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        vm.startPrank(alice);
        usdc.approve(address(ob), 10 * USDC);
        uint256 orderId = ob.placeOrder(marketId, 0, OrderBook.Side.BUY, 500_000, 20 * USDC);
        uint256 beforeCancel = usdc.balanceOf(alice);
        ob.cancelOrder(orderId);
        assertGt(usdc.balanceOf(alice), beforeCancel);
        vm.stopPrank();
    }

    function testCancelRemovesBestAndPromotesNextPrice() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        uint256 betterBid = _placeBuy(alice, marketId, 0, 700_000, 20 * USDC);
        _placeBuy(alice, marketId, 0, 600_000, 20 * USDC);

        vm.prank(alice);
        ob.cancelOrder(betterBid);

        (uint256 bestBid, uint256 bestBidSize) = ob.getBestBid(marketId, 0);
        assertEq(bestBid, 600_000);
        assertEq(bestBidSize, 20 * USDC);
        assertEq(ob.activePriceLevelCount(marketId, 0, uint8(OrderBook.Side.BUY)), 1);
    }

    function testRejectsMoreThanMaximumPriceLevels() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);

        vm.startPrank(alice);
        usdc.approve(address(ob), 2 * USDC);
        for (uint256 i; i < ob.MAX_PRICE_LEVELS(); ++i) {
            ob.placeOrder(marketId, 0, OrderBook.Side.BUY, 10_000 + i, 1 * USDC);
        }

        assertEq(ob.activePriceLevelCount(marketId, 0, uint8(OrderBook.Side.BUY)), ob.MAX_PRICE_LEVELS());
        vm.expectRevert(bytes("OB: too many levels"));
        ob.placeOrder(marketId, 0, OrderBook.Side.BUY, 20_000, 1 * USDC);
        vm.stopPrank();
    }

    function testBuyTakerExecutesAtMakerPriceAndReceivesImprovementRefund() public {
        uint256 marketId = _createMarket(MarketFactory.OracleMode.OPTIMISTIC);
        _split(bob, marketId, 10 * USDC);

        _placeSell(bob, marketId, 0, 600_000, 10 * USDC);

        uint256 beforeBuy = usdc.balanceOf(alice);
        _placeBuy(alice, marketId, 0, 700_000, 10 * USDC);
        assertEq(usdc.balanceOf(alice), beforeBuy - 6 * USDC);
    }

    function _placeBuy(address maker, uint256 marketId, uint256 outcomeIndex, uint256 price, uint256 size)
        internal
        returns (uint256 orderId)
    {
        vm.startPrank(maker);
        usdc.approve(address(ob), _quote(size, price));
        orderId = ob.placeOrder(marketId, outcomeIndex, OrderBook.Side.BUY, price, size);
        vm.stopPrank();
    }

    function _placeSell(address maker, uint256 marketId, uint256 outcomeIndex, uint256 price, uint256 size)
        internal
        returns (uint256 orderId)
    {
        vm.startPrank(maker);
        ct.setApprovalForAll(address(ob), true);
        orderId = ob.placeOrder(marketId, outcomeIndex, OrderBook.Side.SELL, price, size);
        vm.stopPrank();
    }

    function _quote(uint256 size, uint256 price) internal pure returns (uint256) {
        return (size * price) / 1_000_000;
    }
}
