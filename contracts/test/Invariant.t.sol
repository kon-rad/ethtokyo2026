// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AICityFactory} from "../src/AICityFactory.sol";
import {PopupCity, CityParams} from "../src/PopupCity.sol";
import {MockUSDC} from "./PopupCity.t.sol";

/// @dev Drives random approve/stake/withdraw/close/claim/cancel/time sequences.
contract CityHandler is Test {
    PopupCity public city;
    MockUSDC public usdc;
    address public host;
    address[] public actors;

    constructor(PopupCity city_, MockUSDC usdc_, address host_) {
        city = city_;
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
        if (city.status() != PopupCity.Status.Open) return;
        if (city.getMember(a).staked) return;
        vm.prank(host);
        city.approve(a, uint32(idx), price);
        if (city.seatCount() >= city.maxSeats()) return;
        usdc.mint(a, price);
        vm.startPrank(a);
        usdc.approve(address(city), price);
        city.stake();
        vm.stopPrank();
    }

    function withdraw(uint256 amountSeed) external {
        if (city.status() != PopupCity.Status.Active) return;
        uint256 bal = city.balance();
        if (bal == 0) return;
        vm.prank(host);
        city.withdraw(bound(amountSeed, 1, bal), bytes32(0), "");
    }

    function close() external {
        if (city.status() != PopupCity.Status.Active) return;
        vm.prank(host);
        city.close();
    }

    function cancel() external {
        if (city.status() != PopupCity.Status.Open) return;
        vm.prank(host);
        city.cancel();
    }

    function claim(uint256 actorSeed) external {
        address a = actors[actorSeed % actors.length];
        if (city.claimable(a) == 0) return;
        vm.prank(a);
        city.claim();
    }

    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 1, 10 days));
    }
}

contract PopupCityInvariantTest is Test {
    PopupCity city;
    MockUSDC usdc;
    CityHandler handler;
    address host = makeAddr("host");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        AICityFactory factory = new AICityFactory(usdc);
        uint64 start = uint64(block.timestamp + 20 days);
        vm.prank(host);
        city = PopupCity(
            factory.createCity(
                CityParams({
                    metadataHash: bytes32(0),
                    startTime: start,
                    endTime: start + 7 days,
                    deadline: uint64(block.timestamp + 10 days),
                    minSeats: 2,
                    maxSeats: 4
                })
            )
        );
        handler = new CityHandler(city, usdc, host);
        targetContract(address(handler));
    }

    /// @notice The contract always holds enough to pay every outstanding claim.
    function invariant_solvent() public view {
        uint256 owed;
        for (uint256 i; i < handler.actorsLength(); i++) {
            owed += city.claimable(handler.actors(i));
        }
        assertGe(city.balance(), owed);
    }

    /// @notice Seats never exceed the maximum.
    function invariant_seatsBounded() public view {
        assertLe(city.seatCount(), city.maxSeats());
    }
}
