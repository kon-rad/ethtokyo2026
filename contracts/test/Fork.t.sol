// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ResidencyFactory} from "../src/ResidencyFactory.sol";
import {Residency, ResidencyParams} from "../src/Residency.sol";

/// @notice Full lifecycle against real mainnet USDC. Skipped unless MAINNET_RPC_URL is set.
///         Run: MAINNET_RPC_URL=... forge test --match-contract Fork -vv
contract ForkTest is Test {
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function test_fork_lifecycleWithRealUSDC() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        IERC20 usdc = IERC20(USDC);
        assertEq(keccak256(bytes(_symbol(USDC))), keccak256("USDC"));

        address host = makeAddr("host");
        ResidencyFactory factory = new ResidencyFactory(usdc);
        uint64 start = uint64(block.timestamp + 10 days);
        vm.prank(host);
        Residency residency = Residency(
            factory.createResidency(
                ResidencyParams({
                    metadataHash: keccak256("fork"),
                    startTime: start,
                    endTime: start + 7 days,
                    deadline: uint64(block.timestamp + 1 days),
                    minSeats: 2,
                    maxSeats: 3
                })
            )
        );

        address a = makeAddr("a");
        address b = makeAddr("b");
        deal(USDC, a, 1e6);
        deal(USDC, b, 2e6);

        vm.startPrank(host);
        residency.approve(a, 1, 1e6);
        residency.approve(b, 2, 2e6);
        vm.stopPrank();

        vm.startPrank(a);
        usdc.approve(address(residency), 1e6);
        residency.stake(1e6);
        vm.stopPrank();
        vm.startPrank(b);
        usdc.approve(address(residency), 2e6);
        residency.stake(2e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        assertEq(uint256(residency.status()), uint256(Residency.Status.Active));

        vm.startPrank(host);
        residency.withdraw(1.5e6, keccak256("receipt"), "deposit");
        residency.close();
        vm.stopPrank();

        vm.prank(a);
        residency.claim();
        vm.prank(b);
        residency.claim();
        assertEq(usdc.balanceOf(a), 0.5e6);
        assertEq(usdc.balanceOf(b), 1e6);
        assertEq(usdc.balanceOf(host), 1.5e6);
    }

    function _symbol(address token) internal view returns (string memory) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("symbol()"));
        require(ok, "symbol");
        return abi.decode(data, (string));
    }
}
