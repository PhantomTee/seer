// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ConditionalToken.sol";
import "../src/MarketFactory.sol";
import "../src/CPMM.sol";
import "../src/OrderBook.sol";
import "../src/DisputeModule.sol";
import "../src/OracleResolver.sol";
import "../src/TreasuryVault.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdc = vm.envAddress("NEXT_PUBLIC_USDC_ADDRESS");

        vm.startBroadcast(deployerKey);

        MarketFactory factory = new MarketFactory(usdc);
        ConditionalToken ct = new ConditionalToken(usdc, address(factory));
        CPMM cpmm = new CPMM(usdc, address(ct), address(factory));
        OrderBook ob = new OrderBook(usdc, address(ct), address(factory));
        DisputeModule dm = new DisputeModule(deployer);
        OracleResolver resolver = new OracleResolver(address(factory), address(ct), address(dm), usdc);
        TreasuryVault vault = new TreasuryVault(usdc, deployer);

        dm.setOracleResolver(address(resolver));
        factory.setConditionalToken(address(ct));
        factory.setOracleResolver(address(resolver));
        factory.setCPMM(address(cpmm));
        factory.setOrderBook(address(ob));
        factory.setTreasuryVault(address(vault));

        vm.stopBroadcast();

        string memory envAppend = string.concat(
            "\n# -- Deployed Contracts (",
            vm.toString(block.chainid),
            ") --\n",
            "NEXT_PUBLIC_MARKET_FACTORY=",
            vm.toString(address(factory)),
            "\n",
            "NEXT_PUBLIC_CONDITIONAL_TOKEN=",
            vm.toString(address(ct)),
            "\n",
            "NEXT_PUBLIC_CPMM=",
            vm.toString(address(cpmm)),
            "\n",
            "NEXT_PUBLIC_ORDER_BOOK=",
            vm.toString(address(ob)),
            "\n",
            "NEXT_PUBLIC_ORACLE_RESOLVER=",
            vm.toString(address(resolver)),
            "\n",
            "NEXT_PUBLIC_DISPUTE_MODULE=",
            vm.toString(address(dm)),
            "\n",
            "NEXT_PUBLIC_TREASURY_VAULT=",
            vm.toString(address(vault)),
            "\n"
        );

        vm.writeLine("../.env.local", envAppend);
        console.log("All contract addresses written to .env.local");
    }
}
