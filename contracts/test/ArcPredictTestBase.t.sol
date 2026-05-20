// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ConditionalToken.sol";
import "../src/MarketFactory.sol";
import "../src/CPMM.sol";
import "../src/OrderBook.sol";
import "../src/OracleResolver.sol";
import "../src/DisputeModule.sol";
import "../src/TreasuryVault.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockAggregatorV3.sol";

abstract contract ArcPredictTestBase is Test {
    MockUSDC internal usdc;
    MarketFactory internal factory;
    ConditionalToken internal ct;
    CPMM internal cpmm;
    OrderBook internal ob;
    OracleResolver internal resolver;
    DisputeModule internal dm;
    TreasuryVault internal vault;
    MockAggregatorV3 internal feed;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA20);
    address internal treasury = address(0x7A);
    address[] internal arbitrators;

    uint256 internal constant USDC = 1e6;

    function setUp() public virtual {
        usdc = new MockUSDC();
        factory = new MarketFactory(address(usdc));
        ct = new ConditionalToken(address(usdc), address(factory));
        cpmm = new CPMM(address(usdc), address(ct), address(factory));
        ob = new OrderBook(address(usdc), address(ct), address(factory));
        dm = new DisputeModule(address(this));
        resolver = new OracleResolver(address(factory), address(ct), address(dm), address(usdc));
        vault = new TreasuryVault(address(usdc), treasury);
        feed = new MockAggregatorV3(8, 100_000e8);

        dm.setOracleResolver(address(resolver));
        factory.setConditionalToken(address(ct));
        factory.setOracleResolver(address(resolver));
        factory.setCPMM(address(cpmm));
        factory.setOrderBook(address(ob));
        factory.setTreasuryVault(address(vault));

        arbitrators = new address[](5);
        for (uint256 i; i < arbitrators.length; ++i) {
            arbitrators[i] = address(uint160(100 + i));
        }
        dm.setArbitrators(arbitrators);

        usdc.mint(alice, 20_000 * USDC);
        usdc.mint(bob, 20_000 * USDC);
        usdc.mint(carol, 20_000 * USDC);
        usdc.mint(address(this), 20_000 * USDC);
    }

    function _labels() internal pure returns (string[] memory labels) {
        labels = new string[](2);
        labels[0] = "YES";
        labels[1] = "NO";
    }

    function _createMarket(MarketFactory.OracleMode mode) internal returns (uint256 marketId) {
        vm.startPrank(alice);
        usdc.approve(address(factory), 5 * USDC);
        marketId = factory.createMarket(
            "Will BTC exceed $200k by Dec 31 2026?",
            "ipfs://criteria",
            block.timestamp + 2 hours,
            mode,
            MarketFactory.MarketType.BINARY,
            mode == MarketFactory.OracleMode.CHAINLINK ? address(feed) : address(0),
            90_000e8,
            true,
            _labels()
        );
        vm.stopPrank();
    }

    function _split(address user, uint256 marketId, uint256 amount) internal {
        vm.startPrank(user);
        usdc.approve(address(ct), amount);
        ct.split(marketId, amount);
        vm.stopPrank();
    }
}
