// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ResidencyFactory} from "../src/ResidencyFactory.sol";

/// @notice Deploys the factory. Mainnet USDC unless USDC_ADDRESS is set (e.g. a local mock).
///   forge script script/Deploy.s.sol --rpc-url mainnet --ledger --broadcast --verify
contract Deploy is Script {
    address constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external returns (ResidencyFactory factory) {
        address usdc = vm.envOr("USDC_ADDRESS", MAINNET_USDC);
        vm.startBroadcast();
        factory = new ResidencyFactory(IERC20(usdc));
        vm.stopBroadcast();
        console.log("ResidencyFactory:", address(factory));
        console.log("USDC:", usdc);
        console.log("Block:", block.number);
    }
}
