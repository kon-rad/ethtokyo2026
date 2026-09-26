// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ResidencyFactory} from "../src/ResidencyFactory.sol";

/// Local mock USDC for Sepolia (no real USDC on Sepolia).
contract SepoliaUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Deploys mock USDC + ResidencyFactory to Sepolia.
///   forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast --verify
contract DeploySepolia is Script {
    function run() external {
        vm.startBroadcast();
        // msg.sender in run() is Foundry's default sender unless --sender is passed; ask for the broadcaster.
        (, address deployer,) = vm.readCallers();
        SepoliaUSDC usdc = new SepoliaUSDC();
        ResidencyFactory factory = new ResidencyFactory(usdc);
        // Fund the deployer with 100k test USDC for smoke testing.
        usdc.mint(deployer, 100_000e6);
        vm.stopBroadcast();
        console.log("USDC:", address(usdc));
        console.log("ResidencyFactory:", address(factory));
        console.log("Block:", block.number);
    }
}