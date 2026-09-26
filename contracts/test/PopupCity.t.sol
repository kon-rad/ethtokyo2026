// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AICityFactory} from "../src/AICityFactory.sol";
import {PopupCity, CityParams} from "../src/PopupCity.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PopupCityTest is Test {
    MockUSDC usdc;
    AICityFactory factory;
    PopupCity city;

    address host = makeAddr("host");
    address stranger = makeAddr("stranger");

    uint256 constant PRICE = 1_000e6;
    uint64 start;
    uint64 end;
    uint64 deadline;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        factory = new AICityFactory(usdc);

        deadline = uint64(block.timestamp + 14 days);
        start = uint64(block.timestamp + 30 days);
        end = start + 21 days;

        vm.prank(host);
        city = PopupCity(factory.createCity(_params(3, 5)));
    }

    function _params(uint32 minSeats, uint32 maxSeats) internal view returns (CityParams memory) {
        return CityParams({
            metadataHash: keccak256("goa"),
            startTime: start,
            endTime: end,
            deadline: deadline,
            minSeats: minSeats,
            maxSeats: maxSeats
        });
    }

    function _member(uint256 i) internal returns (address m) {
        m = makeAddr(string.concat("member", vm.toString(i)));
    }

    function _approveAndStake(uint256 i, uint32 bed, uint256 price) internal returns (address m) {
        m = _member(i);
        vm.prank(host);
        city.approve(m, bed, price);
        usdc.mint(m, price);
        vm.startPrank(m);
        usdc.approve(address(city), price);
        city.stake();
        vm.stopPrank();
    }

    // ------------------------------------------------------------ construction

    function test_factoryRecordsCity() public view {
        assertEq(factory.citiesLength(), 1);
        assertEq(factory.cityAt(0), address(city));
        assertEq(city.host(), host);
        assertEq(address(city.usdc()), address(usdc));
        assertEq(uint256(city.status()), uint256(PopupCity.Status.Open));
    }

    function test_rejectsShortDuration() public {
        CityParams memory p = _params(1, 2);
        p.endTime = p.startTime + 6 days;
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(p);
    }

    function test_rejectsDeadlineAfterStart() public {
        CityParams memory p = _params(1, 2);
        p.deadline = p.startTime + 1;
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(p);
    }

    function test_rejectsDeadlineInPast() public {
        CityParams memory p = _params(1, 2);
        p.deadline = uint64(block.timestamp);
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(p);
    }

    function test_rejectsBadSeats() public {
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(_params(0, 2));
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(_params(3, 2));
        vm.expectRevert(PopupCity.InvalidParams.selector);
        factory.createCity(_params(1, 501));
    }

    // ------------------------------------------------------------ happy path

    function test_happyPath_mixedPrices_proRataLeftovers() public {
        address a = _approveAndStake(1, 1, 600e6); // shared bed
        address b = _approveAndStake(2, 2, 1_000e6); // private
        address c = _approveAndStake(3, 3, 1_400e6); // private, large
        assertEq(city.totalStaked(), 3_000e6);

        vm.warp(deadline);
        assertEq(uint256(city.status()), uint256(PopupCity.Status.Active));

        vm.prank(host);
        city.withdraw(2_400e6, keccak256("receipt"), "Villa deposit");
        assertEq(usdc.balanceOf(host), 2_400e6);

        vm.prank(host);
        city.close();
        assertEq(city.closedBalance(), 600e6);

        // Leftovers pro-rata to stake: 600 * (600, 1000, 1400) / 3000
        assertEq(city.claimable(a), 120e6);
        assertEq(city.claimable(b), 200e6);
        assertEq(city.claimable(c), 280e6);

        vm.prank(a);
        city.claim();
        vm.prank(b);
        city.claim();
        vm.prank(c);
        city.claim();
        assertEq(usdc.balanceOf(a), 120e6);
        assertEq(usdc.balanceOf(address(city)), 0);

        vm.prank(a);
        vm.expectRevert(PopupCity.NothingToClaim.selector);
        city.claim();
    }

    // ------------------------------------------------------------ failure paths

    function test_minimumMissed_fullRefunds() public {
        address a = _approveAndStake(1, 1, PRICE);
        address b = _approveAndStake(2, 2, 700e6);

        vm.warp(deadline);
        assertEq(uint256(city.status()), uint256(PopupCity.Status.Failed));

        vm.prank(host);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.WrongStatus.selector, PopupCity.Status.Failed));
        city.withdraw(1, bytes32(0), "");

        vm.prank(a);
        city.claim();
        vm.prank(b);
        city.claim();
        assertEq(usdc.balanceOf(a), PRICE);
        assertEq(usdc.balanceOf(b), 700e6);
        assertEq(usdc.balanceOf(address(city)), 0);
    }

    function test_cancel_fullRefunds() public {
        address a = _approveAndStake(1, 1, PRICE);
        vm.prank(host);
        city.cancel();
        assertEq(uint256(city.status()), uint256(PopupCity.Status.Failed));

        vm.prank(a);
        city.claim();
        assertEq(usdc.balanceOf(a), PRICE);
    }

    function test_cancel_onlyHost_onlyOpen() public {
        vm.prank(stranger);
        vm.expectRevert(PopupCity.NotHost.selector);
        city.cancel();

        vm.warp(deadline);
        vm.prank(host);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.WrongStatus.selector, PopupCity.Status.Failed));
        city.cancel();
    }

    function test_cannotStakeAfterDeadline() public {
        address m = _member(1);
        vm.prank(host);
        city.approve(m, 1, PRICE);
        usdc.mint(m, PRICE);
        vm.warp(deadline);
        vm.startPrank(m);
        usdc.approve(address(city), PRICE);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.WrongStatus.selector, PopupCity.Status.Failed));
        city.stake();
        vm.stopPrank();
    }

    // ------------------------------------------------------------ approvals and beds

    function test_bedCannotBeDoubleBooked() public {
        address a = _member(1);
        address b = _member(2);
        vm.startPrank(host);
        city.approve(a, 7, PRICE);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.BedTaken.selector, uint32(7), a));
        city.approve(b, 7, PRICE);
        vm.stopPrank();
    }

    function test_reapproveMovesBed() public {
        address a = _member(1);
        vm.startPrank(host);
        city.approve(a, 1, PRICE);
        city.approve(a, 2, 800e6);
        vm.stopPrank();
        assertEq(city.bedHolder(1), address(0));
        assertEq(city.bedHolder(2), a);
        assertEq(city.getMember(a).price, 800e6);
    }

    function test_revokeFreesBed_notAfterStake() public {
        address a = _member(1);
        vm.prank(host);
        city.approve(a, 1, PRICE);
        vm.prank(host);
        city.revoke(a);
        assertEq(city.bedHolder(1), address(0));
        assertFalse(city.getMember(a).approved);

        address b = _approveAndStake(2, 2, PRICE);
        vm.prank(host);
        vm.expectRevert(PopupCity.AlreadyStaked.selector);
        city.revoke(b);
        vm.prank(host);
        vm.expectRevert(PopupCity.AlreadyStaked.selector);
        city.approve(b, 3, 1);
    }

    function test_unapprovedCannotStake() public {
        usdc.mint(stranger, PRICE);
        vm.startPrank(stranger);
        usdc.approve(address(city), PRICE);
        vm.expectRevert(PopupCity.NotApproved.selector);
        city.stake();
        vm.stopPrank();
    }

    function test_doubleStakeReverts() public {
        address a = _approveAndStake(1, 1, PRICE);
        usdc.mint(a, PRICE);
        vm.startPrank(a);
        usdc.approve(address(city), PRICE);
        vm.expectRevert(PopupCity.AlreadyStaked.selector);
        city.stake();
        vm.stopPrank();
    }

    function test_maxSeats() public {
        for (uint256 i = 1; i <= 5; i++) {
            _approveAndStake(i, uint32(i), PRICE);
        }
        address extra = _member(6);
        vm.prank(host);
        city.approve(extra, 6, PRICE);
        usdc.mint(extra, PRICE);
        vm.startPrank(extra);
        usdc.approve(address(city), PRICE);
        vm.expectRevert(PopupCity.CityFull.selector);
        city.stake();
        vm.stopPrank();
    }

    function test_hostOnlyFunctions() public {
        vm.startPrank(stranger);
        vm.expectRevert(PopupCity.NotHost.selector);
        city.approve(stranger, 1, PRICE);
        vm.expectRevert(PopupCity.NotHost.selector);
        city.revoke(stranger);
        vm.expectRevert(PopupCity.NotHost.selector);
        city.withdraw(1, bytes32(0), "");
        vm.stopPrank();
    }

    function test_rejectsZeroPriceAndZeroAddress() public {
        vm.startPrank(host);
        vm.expectRevert(PopupCity.InvalidMember.selector);
        city.approve(_member(1), 1, 0);
        vm.expectRevert(PopupCity.InvalidMember.selector);
        city.approve(address(0), 1, PRICE);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ withdraw and close

    function test_withdrawLimits() public {
        for (uint256 i = 1; i <= 3; i++) {
            _approveAndStake(i, uint32(i), PRICE);
        }
        vm.prank(host);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.WrongStatus.selector, PopupCity.Status.Open));
        city.withdraw(1, bytes32(0), "");

        vm.warp(deadline);
        vm.startPrank(host);
        vm.expectRevert(PopupCity.InvalidAmount.selector);
        city.withdraw(3_000e6 + 1, bytes32(0), "");
        vm.expectRevert(PopupCity.InvalidAmount.selector);
        city.withdraw(0, bytes32(0), "");
        vm.expectRevert(PopupCity.NoteTooLong.selector);
        city.withdraw(1, bytes32(0), string(new bytes(281)));
        city.withdraw(3_000e6, keccak256("all"), "Full rent");
        vm.stopPrank();
        assertEq(city.totalWithdrawn(), 3_000e6);
    }

    function test_anyoneCanCloseAfterEnd_hostAnytime() public {
        address a = _approveAndStake(1, 1, PRICE);
        _approveAndStake(2, 2, PRICE);
        _approveAndStake(3, 3, PRICE);
        vm.warp(deadline);

        vm.prank(stranger);
        vm.expectRevert(PopupCity.CloseNotAllowed.selector);
        city.close();

        vm.warp(end);
        vm.prank(stranger);
        city.close();
        assertEq(uint256(city.status()), uint256(PopupCity.Status.Closed));
        assertEq(city.claimable(a), PRICE);

        vm.prank(host);
        vm.expectRevert(abi.encodeWithSelector(PopupCity.WrongStatus.selector, PopupCity.Status.Closed));
        city.withdraw(1, bytes32(0), "");
    }

    function test_claimNothingWhileOpenOrActive() public {
        address a = _approveAndStake(1, 1, PRICE);
        vm.prank(a);
        vm.expectRevert(PopupCity.NothingToClaim.selector);
        city.claim();
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_leftoversNeverExceedBalance(uint96 p1, uint96 p2, uint96 p3, uint96 spend) public {
        uint256[3] memory prices = [uint256(bound(p1, 1, 1e12)), uint256(bound(p2, 1, 1e12)), uint256(bound(p3, 1, 1e12))];
        address[3] memory ms;
        for (uint256 i; i < 3; i++) {
            ms[i] = _approveAndStake(i + 1, uint32(i + 1), prices[i]);
        }
        vm.warp(deadline);
        uint256 total = prices[0] + prices[1] + prices[2];
        uint256 spent = bound(spend, 0, total);
        if (spent > 0) {
            vm.prank(host);
            city.withdraw(spent, bytes32(0), "");
        }
        vm.prank(host);
        city.close();

        uint256 paid;
        for (uint256 i; i < 3; i++) {
            uint256 before = usdc.balanceOf(ms[i]);
            if (city.claimable(ms[i]) > 0) {
                vm.prank(ms[i]);
                city.claim();
            }
            paid += usdc.balanceOf(ms[i]) - before;
        }
        assertLe(paid, total - spent);
        assertLe(total - spent - paid, 3); // rounding dust only
    }
}
