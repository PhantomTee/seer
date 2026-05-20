// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OrderBook
 * @notice Price-time priority CLOB for ArcPredict conditional tokens.
 * @dev Arc's deterministic finality removes probabilistic confirmation/reorg
 *      handling from the UX, but matching must still be bounded for gas safety.
 *      Each market/outcome/side has a sorted doubly-linked price list and each
 *      price level has a FIFO order queue. No operation scans global history.
 */
contract OrderBook is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint256 id;
        address maker;
        uint256 marketId;
        uint256 outcomeIndex;
        Side side;
        uint256 price;
        uint256 size;
        uint256 filled;
        uint256 timestamp;
        bool cancelled;
        bool onBook;
    }

    struct PriceLevel {
        bool exists;
        uint256 prev;
        uint256 next;
        uint256 head;
        uint256 tail;
        uint256 aggregateSize;
    }

    uint256 public constant PRICE_SCALE = 1_000_000;
    uint256 public constant TAKER_FEE_BPS = 10;
    uint256 public constant PROTOCOL_FEE_BPS = 8;
    uint256 public constant CPMM_FEE_BPS = 2;
    uint256 public constant MAX_MATCHES = 50;
    uint256 public constant MAX_PRICE_LEVELS = 64;
    uint256 public constant MAX_DEPTH_LEVELS = 25;

    IERC20 public immutable usdc;
    IConditionalTokenOrderBook public immutable conditionalToken;
    address public immutable marketFactory;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256) public reservedUsdc;
    mapping(address => uint256[]) private makerOrders;

    // marketId -> outcomeIndex -> side -> price -> level
    mapping(uint256 => mapping(uint256 => mapping(uint8 => mapping(uint256 => PriceLevel)))) private priceLevels;
    // marketId -> outcomeIndex -> side -> best price
    mapping(uint256 => mapping(uint256 => mapping(uint8 => uint256))) private bestPrice;
    // marketId -> outcomeIndex -> side -> active price count
    mapping(uint256 => mapping(uint256 => mapping(uint8 => uint256))) public activePriceLevelCount;
    // orderId -> next order at same price level
    mapping(uint256 => uint256) private nextOrderAtPrice;

    event OrderPlaced(uint256 indexed orderId, address indexed maker, uint256 marketId, uint256 outcomeIndex, Side side, uint256 price, uint256 size);
    event OrderFilled(uint256 indexed orderId, uint256 filledAmount, uint256 price);
    event OrderCancelled(uint256 indexed orderId);
    event Trade(uint256 indexed marketId, uint256 outcomeIndex, uint256 price, uint256 size, address buyer, address seller);

    constructor(address _usdc, address _conditionalToken, address _marketFactory) {
        require(_usdc != address(0) && _conditionalToken != address(0) && _marketFactory != address(0), "OB: zero address");
        usdc = IERC20(_usdc);
        conditionalToken = IConditionalTokenOrderBook(_conditionalToken);
        marketFactory = _marketFactory;
    }

    function placeOrder(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price, uint256 size)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        require(price > 0 && price <= PRICE_SCALE, "OB: bad price");
        require(size > 0, "OB: zero size");

        orderId = nextOrderId++;
        Order storage order = orders[orderId];
        order.id = orderId;
        order.maker = msg.sender;
        order.marketId = marketId;
        order.outcomeIndex = outcomeIndex;
        order.side = side;
        order.price = price;
        order.size = size;
        order.timestamp = block.timestamp;

        if (side == Side.BUY) {
            uint256 quote = _quote(size, price);
            reservedUsdc[orderId] = quote;
            usdc.safeTransferFrom(msg.sender, address(this), quote);
        } else {
            uint256 token = conditionalToken.tokenId(marketId, outcomeIndex);
            conditionalToken.safeTransferFrom(msg.sender, address(this), token, size, "");
        }

        makerOrders[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, marketId, outcomeIndex, side, price, size);

        _matchOrder(orderId);

        uint256 remaining = _remaining(order);
        if (remaining > 0) {
            _addOrderToBook(orderId, remaining);
        } else {
            _refundClosedBuyOrder(orderId);
        }
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "OB: not maker");
        require(!order.cancelled, "OB: cancelled");
        uint256 remaining = _remaining(order);
        require(remaining > 0 && order.onBook, "OB: filled");

        order.cancelled = true;
        order.onBook = false;
        PriceLevel storage level = _level(order.marketId, order.outcomeIndex, order.side, order.price);
        level.aggregateSize -= remaining;

        if (order.side == Side.BUY) {
            uint256 refund = reservedUsdc[orderId];
            reservedUsdc[orderId] = 0;
            if (refund > 0) usdc.safeTransfer(order.maker, refund);
        } else {
            uint256 token = conditionalToken.tokenId(order.marketId, order.outcomeIndex);
            conditionalToken.safeTransferFrom(address(this), order.maker, token, remaining, "");
        }

        _pruneLevelHead(order.marketId, order.outcomeIndex, order.side, order.price);
        if (level.aggregateSize == 0) {
            _removePriceLevel(order.marketId, order.outcomeIndex, order.side, order.price);
        }
        emit OrderCancelled(orderId);
    }

    function getOrdersByMaker(address maker) external view returns (uint256[] memory) {
        return makerOrders[maker];
    }

    function getBestBid(uint256 marketId, uint256 outcomeIndex) external view returns (uint256 price, uint256 size) {
        price = bestPrice[marketId][outcomeIndex][uint8(Side.BUY)];
        size = price == 0 ? 0 : priceLevels[marketId][outcomeIndex][uint8(Side.BUY)][price].aggregateSize;
    }

    function getBestAsk(uint256 marketId, uint256 outcomeIndex) external view returns (uint256 price, uint256 size) {
        price = bestPrice[marketId][outcomeIndex][uint8(Side.SELL)];
        size = price == 0 ? 0 : priceLevels[marketId][outcomeIndex][uint8(Side.SELL)][price].aggregateSize;
    }

    function getDepth(uint256 marketId, uint256 outcomeIndex, Side side, uint256 levels)
        external
        view
        returns (uint256[] memory prices, uint256[] memory sizes)
    {
        uint256 capped = levels > MAX_DEPTH_LEVELS ? MAX_DEPTH_LEVELS : levels;
        prices = new uint256[](capped);
        sizes = new uint256[](capped);

        uint256 price = bestPrice[marketId][outcomeIndex][uint8(side)];
        for (uint256 i; i < capped && price != 0; ++i) {
            PriceLevel storage level = priceLevels[marketId][outcomeIndex][uint8(side)][price];
            prices[i] = price;
            sizes[i] = level.aggregateSize;
            price = level.next;
        }
    }

    function getPriceLevel(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price)
        external
        view
        returns (uint256 prev, uint256 next, uint256 head, uint256 tail, uint256 aggregateSize, bool exists)
    {
        PriceLevel storage level = priceLevels[marketId][outcomeIndex][uint8(side)][price];
        return (level.prev, level.next, level.head, level.tail, level.aggregateSize, level.exists);
    }

    function _matchOrder(uint256 incomingId) internal {
        Order storage incoming = orders[incomingId];
        Side opposite = incoming.side == Side.BUY ? Side.SELL : Side.BUY;
        uint256 matches;

        while (_remaining(incoming) > 0 && matches < MAX_MATCHES) {
            uint256 price = bestPrice[incoming.marketId][incoming.outcomeIndex][uint8(opposite)];
            if (price == 0 || !_isCrossing(incoming.side, incoming.price, price)) break;

            _pruneLevelHead(incoming.marketId, incoming.outcomeIndex, opposite, price);
            PriceLevel storage level = _level(incoming.marketId, incoming.outcomeIndex, opposite, price);
            uint256 makerId = level.head;
            if (makerId == 0) {
                _removePriceLevel(incoming.marketId, incoming.outcomeIndex, opposite, price);
                continue;
            }

            _fillAgainstMaker(incomingId, makerId, level, price);
            matches++;
        }
    }

    function _fillAgainstMaker(uint256 incomingId, uint256 makerId, PriceLevel storage level, uint256 tradePrice) internal {
        Order storage incoming = orders[incomingId];
        Order storage maker = orders[makerId];
        uint256 fillSize = _min(_remaining(incoming), _remaining(maker));
        uint256 quote = _quote(fillSize, tradePrice);
        uint256 fee = (quote * TAKER_FEE_BPS) / 10_000;
        address buyer = incoming.side == Side.BUY ? incoming.maker : maker.maker;
        address seller = incoming.side == Side.SELL ? incoming.maker : maker.maker;

        incoming.filled += fillSize;
        maker.filled += fillSize;
        level.aggregateSize -= fillSize;

        if (incoming.side == Side.BUY) {
            uint256 limitQuote = _quote(fillSize, incoming.price);
            reservedUsdc[incomingId] -= limitQuote;
            uint256 improvement = limitQuote - quote;
            if (improvement > 0) usdc.safeTransfer(incoming.maker, improvement);
        } else {
            reservedUsdc[makerId] -= quote;
        }

        _payFeesAndSeller(quote, fee, seller);
        uint256 token = conditionalToken.tokenId(incoming.marketId, incoming.outcomeIndex);
        conditionalToken.safeTransferFrom(address(this), buyer, token, fillSize, "");

        if (_remaining(maker) == 0) {
            maker.onBook = false;
            _popLevelHead(level, makerId);
            if (maker.side == Side.BUY) reservedUsdc[makerId] = 0;
        }
        if (level.aggregateSize == 0) {
            _removePriceLevel(maker.marketId, maker.outcomeIndex, maker.side, maker.price);
        }

        emit OrderFilled(incomingId, fillSize, tradePrice);
        emit OrderFilled(makerId, fillSize, tradePrice);
        emit Trade(incoming.marketId, incoming.outcomeIndex, tradePrice, fillSize, buyer, seller);
    }

    function _addOrderToBook(uint256 orderId, uint256 remaining) internal {
        Order storage order = orders[orderId];
        if (!_level(order.marketId, order.outcomeIndex, order.side, order.price).exists) {
            _insertPriceLevel(order.marketId, order.outcomeIndex, order.side, order.price);
        }

        PriceLevel storage level = _level(order.marketId, order.outcomeIndex, order.side, order.price);
        if (level.tail == 0) {
            level.head = orderId;
            level.tail = orderId;
        } else {
            nextOrderAtPrice[level.tail] = orderId;
            level.tail = orderId;
        }
        level.aggregateSize += remaining;
        order.onBook = true;
    }

    function _insertPriceLevel(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price) internal {
        uint8 sideKey = uint8(side);
        require(activePriceLevelCount[marketId][outcomeIndex][sideKey] < MAX_PRICE_LEVELS, "OB: too many levels");

        PriceLevel storage newLevel = priceLevels[marketId][outcomeIndex][sideKey][price];
        newLevel.exists = true;
        newLevel.prev = 0;
        newLevel.next = 0;
        newLevel.head = 0;
        newLevel.tail = 0;
        newLevel.aggregateSize = 0;
        activePriceLevelCount[marketId][outcomeIndex][sideKey]++;

        uint256 best = bestPrice[marketId][outcomeIndex][sideKey];
        if (best == 0) {
            bestPrice[marketId][outcomeIndex][sideKey] = price;
            return;
        }

        if (_isBetterPrice(side, price, best)) {
            newLevel.next = best;
            priceLevels[marketId][outcomeIndex][sideKey][best].prev = price;
            bestPrice[marketId][outcomeIndex][sideKey] = price;
            return;
        }

        uint256 current = best;
        for (uint256 i; i < MAX_PRICE_LEVELS; ++i) {
            uint256 next = priceLevels[marketId][outcomeIndex][sideKey][current].next;
            if (next == 0 || _isBetterPrice(side, price, next)) {
                newLevel.prev = current;
                newLevel.next = next;
                priceLevels[marketId][outcomeIndex][sideKey][current].next = price;
                if (next != 0) {
                    priceLevels[marketId][outcomeIndex][sideKey][next].prev = price;
                }
                return;
            }
            current = next;
        }
        revert("OB: level insert failed");
    }

    function _removePriceLevel(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price) internal {
        uint8 sideKey = uint8(side);
        PriceLevel storage level = priceLevels[marketId][outcomeIndex][sideKey][price];
        if (!level.exists || level.aggregateSize != 0) return;

        uint256 prev = level.prev;
        uint256 next = level.next;
        if (prev != 0) {
            priceLevels[marketId][outcomeIndex][sideKey][prev].next = next;
        } else {
            bestPrice[marketId][outcomeIndex][sideKey] = next;
        }
        if (next != 0) {
            priceLevels[marketId][outcomeIndex][sideKey][next].prev = prev;
        }

        delete priceLevels[marketId][outcomeIndex][sideKey][price];
        activePriceLevelCount[marketId][outcomeIndex][sideKey]--;
    }

    function _pruneLevelHead(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price) internal {
        PriceLevel storage level = _level(marketId, outcomeIndex, side, price);
        while (level.head != 0) {
            Order storage head = orders[level.head];
            if (!head.cancelled && _remaining(head) > 0) break;
            _popLevelHead(level, level.head);
        }
    }

    function _popLevelHead(PriceLevel storage level, uint256 expectedHead) internal {
        if (level.head != expectedHead) return;
        uint256 next = nextOrderAtPrice[expectedHead];
        nextOrderAtPrice[expectedHead] = 0;
        level.head = next;
        if (next == 0) level.tail = 0;
    }

    function _payFeesAndSeller(uint256 quote, uint256 fee, address seller) internal {
        uint256 protocolFee = (quote * PROTOCOL_FEE_BPS) / 10_000;
        uint256 cpmmFee = fee - protocolFee;
        address treasury = IOrderBookFactory(marketFactory).treasuryVault();
        address cpmm = IOrderBookFactory(marketFactory).cpmm();
        if (protocolFee > 0) usdc.safeTransfer(treasury, protocolFee);
        if (cpmmFee > 0) usdc.safeTransfer(cpmm, cpmmFee);
        usdc.safeTransfer(seller, quote - fee);
    }

    function _refundClosedBuyOrder(uint256 orderId) internal {
        uint256 refund = reservedUsdc[orderId];
        if (refund > 0) {
            reservedUsdc[orderId] = 0;
            usdc.safeTransfer(orders[orderId].maker, refund);
        }
    }

    function _level(uint256 marketId, uint256 outcomeIndex, Side side, uint256 price)
        internal
        view
        returns (PriceLevel storage)
    {
        return priceLevels[marketId][outcomeIndex][uint8(side)][price];
    }

    function _isCrossing(Side incomingSide, uint256 incomingPrice, uint256 makerPrice) internal pure returns (bool) {
        return incomingSide == Side.BUY ? makerPrice <= incomingPrice : makerPrice >= incomingPrice;
    }

    function _isBetterPrice(Side side, uint256 a, uint256 b) internal pure returns (bool) {
        return side == Side.BUY ? a > b : a < b;
    }

    function _remaining(Order storage order) internal view returns (uint256) {
        return order.size - order.filled;
    }

    function _quote(uint256 size, uint256 price) internal pure returns (uint256) {
        return (size * price) / PRICE_SCALE;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

interface IConditionalTokenOrderBook {
    function tokenId(uint256 marketId, uint256 outcomeIndex) external pure returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
}

interface IOrderBookFactory {
    function treasuryVault() external view returns (address);
    function cpmm() external view returns (address);
}
