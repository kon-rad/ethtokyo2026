// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ResidencyFactory} from "../src/ResidencyFactory.sol";
import {Residency, ResidencyParams} from "../src/Residency.sol";
import {MockUSDC} from "./Residency.t.sol";

/// @dev Drives random approve/stake/withdraw/close/claim/cancel/time sequences.
contract ResidencyHandler is Test {
    Residency public residency;
    MockUSDC public usdc;
    address public host;
    address[] public actors;

    constructor(Residency residency_, MockUSDC usdc_, address host_) {
        residency = residency_;
        usdc = usdc_;
        host = host_;
        for (uint256 i; i < 6; i++) {
            actors.push(makeAddr(string.concat("actor", vm.toString(i))));
        }
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function approveAndStake(uint256 actorSeed, uint256 priceSeed) external {
        uint256 idx = actorSeed % actors.length;
        address a = actors[idx];
        uint256 price = bound(priceSeed, 1, 5_000e6);
        if (residency.status() != Residency.Status.Open) return;
        if (residency.getMember(a).staked) return;
        vm.prank(host);
        residency.approve(a, uint32(idx), price);
        if (residency.seatCount() >= residency.maxSeats()) return;
        usdc.mint(a, price);
        vm.startPrank(a);
        usdc.approve(address(residency), price);
        residency.stake();
        vm.stopPrank();
    }

    function withdraw(uint256 amountSeed) external {
        if (residency.status() != Residency.Status.Active) return;
        uint256 bal = residency.balance();
        if (bal == 0) return;
        vm.prank(host);
        residency.withdraw(bound(amountSeed, 1, bal), bytes32(0), "");
    }

    function close() external {
        if (residency.status() != Residency.Status.Active) return;
        vm.prank(host);
        residency.close();
    }

    function cancel() external {
        if (residency.status() != Residency.Status.Open) return;
        vm.prank(host);
        residency.cancel();
    }

    function claim(uint256 actorSeed) external {
        address a = actors[actorSeed % actors.length];
        if (residency.claimable(a) == 0) return;
        vm.prank(a);
        residency.claim();
    }

    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 1, 10 days));
    }
}

contract ResidencyInvariantTest is Test {
    Residency residency;
    MockUSDC usdc;
    ResidencyHandler handler;
    address host = makeAddr("host");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        ResidencyFactory factory = new ResidencyFactory(usdc);
        uint64 start = uint64(block.timestamp + 20 days);
        vm.prank(host);
        residency = Residency(
            factory.createResidency(
                ResidencyParams({
                    metadataHash: bytes32(0),
                    startTime: start,
                    endTime: start + 7 days,
                    deadline: uint64(block.timestamp + 10 days),
                    minSeats: 2,
                    maxSeats: 4
                })
            )
        );
        handler = new ResidencyHandler(residency, usdc, host);
        targetContract(address(handler));
    }

    /// @notice The contract always holds enough to pay every outstanding claim.
    function invariant_solvent() public view {
        uint256 owed;
        for (uint256 i; i < handler.actorsLength(); i++) {
            owed += residency.claimable(handler.actors(i));
        }
        assertGe(residency.balance(), owed);
    }

    /// @notice Seats never exceed the maximum.
    function invariant_seatsBounded() public view {
        assertLe(residency.seatCount(), residency.maxSeats());
    }
}
