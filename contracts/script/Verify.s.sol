// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

contract VerifyScript is Script {
    function run() external pure {
        console.log("Use pnpm contracts:verify with the deployed address and constructor args.");
    }
}
