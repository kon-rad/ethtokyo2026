// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ResidencyFactory} from "../src/ResidencyFactory.sol";

contract LocalUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Local anvil setup: mock USDC (anyone can mint) + factory.
///   anvil & forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
contract DeployLocal is Script {
    function run() external {
        vm.startBroadcast();
        LocalUSDC usdc = new LocalUSDC();
        ResidencyFactory factory = new ResidencyFactory(usdc);
        // Fund anvil's first three accounts with 100k test USDC each.
        usdc.mint(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 100_000e6);
        usdc.mint(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 100_000e6);
        usdc.mint(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 100_000e6);
        vm.stopBroadcast();
        console.log("USDC:", address(usdc));
        console.log("ResidencyFactory:", address(factory));
    }
}
