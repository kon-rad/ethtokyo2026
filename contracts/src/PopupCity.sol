// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Launch parameters for a pop-up city. Descriptive data (name, rooms, organizers)
///         lives offchain; `metadataHash` pins it.
struct CityParams {
    bytes32 metadataHash;
    uint64 startTime;
    uint64 endTime;
    uint64 deadline;
    uint32 minSeats;
    uint32 maxSeats;
}

/// @title PopupCity
/// @notice One pop-up city's seat escrow. The host approves members for a bed at a price,
///         members stake that price in USDC before the deadline, and at the deadline the city
///         is either Active (enough seats: the host can withdraw against receipts) or Failed
///         (everyone claims a full refund). Closing returns unspent funds pro-rata to stake.
/// @dev Unaudited. No proxy, no admin beyond the host, no external calls except the token.
contract PopupCity is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Open,
        Active,
        Failed,
        Closed
    }

    struct Member {
        bool approved;
        bool staked;
        bool claimed;
        uint32 bedId;
        uint256 price;
    }

    uint256 public constant MIN_DURATION = 7 days;
    uint256 public constant MAX_SEATS = 500;
    uint256 public constant MAX_NOTE_LENGTH = 280;

    address public immutable host;
    IERC20 public immutable usdc;
    bytes32 public immutable metadataHash;
    uint64 public immutable startTime;
    uint64 public immutable endTime;
    uint64 public immutable deadline;
    uint32 public immutable minSeats;
    uint32 public immutable maxSeats;

    mapping(address => Member) private _members;
    mapping(uint32 => address) public bedHolder;

    uint256 public seatCount;
    uint256 public totalStaked;
    uint256 public totalWithdrawn;
    uint256 public closedBalance;
    bool public cancelled;
    bool public closed;

    event Approved(address indexed member, uint32 indexed bedId, uint256 price);
    event Revoked(address indexed member, uint32 indexed bedId);
    event Staked(address indexed member, uint32 indexed bedId, uint256 price, uint256 seatNumber);
    event Cancelled();
    event Withdrawn(uint256 amount, bytes32 indexed receiptHash, string note);
    event Closed(uint256 closedBalance);
    event Claimed(address indexed member, uint256 amount);

    error NotHost();
    error InvalidParams();
    error WrongStatus(Status current);
    error InvalidMember();
    error BedTaken(uint32 bedId, address holder);
    error NotApproved();
    error AlreadyStaked();
    error CityFull();
    error NothingToClaim();
    error InvalidAmount();
    error NoteTooLong();
    error CloseNotAllowed();

    modifier onlyHost() {
        if (msg.sender != host) revert NotHost();
        _;
    }

    modifier inStatus(Status expected) {
        Status current = status();
        if (current != expected) revert WrongStatus(current);
        _;
    }

    constructor(address host_, IERC20 usdc_, CityParams memory p) {
        if (host_ == address(0) || address(usdc_) == address(0)) revert InvalidParams();
        if (p.endTime < p.startTime || p.endTime - p.startTime < MIN_DURATION) revert InvalidParams();
        if (p.deadline <= block.timestamp || p.deadline > p.startTime) revert InvalidParams();
        if (p.minSeats == 0 || p.minSeats > p.maxSeats || p.maxSeats > MAX_SEATS) revert InvalidParams();

        host = host_;
        usdc = usdc_;
        metadataHash = p.metadataHash;
        startTime = p.startTime;
        endTime = p.endTime;
        deadline = p.deadline;
        minSeats = p.minSeats;
        maxSeats = p.maxSeats;
    }

    // ------------------------------------------------------------------ views

    /// @notice Open until the deadline; then Active if enough seats were staked, else Failed.
    function status() public view returns (Status) {
        if (closed) return Status.Closed;
        if (cancelled) return Status.Failed;
        if (block.timestamp < deadline) return Status.Open;
        return seatCount >= minSeats ? Status.Active : Status.Failed;
    }

    function getMember(address account) external view returns (Member memory) {
        return _members[account];
    }

    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice What `account` could receive from `claim()` right now.
    function claimable(address account) public view returns (uint256) {
        Member memory m = _members[account];
        if (!m.staked || m.claimed) return 0;
        Status s = status();
        if (s == Status.Failed) return m.price;
        if (s == Status.Closed) return (closedBalance * m.price) / totalStaked;
        return 0;
    }

    // ------------------------------------------------------------------ host

    /// @notice Approve `member` for `bedId` at `price` (USDC, 6 decimals). Re-approving an
    ///         unstaked member moves them to the new bed and price.
    function approve(address member, uint32 bedId, uint256 price) external onlyHost inStatus(Status.Open) {
        if (member == address(0) || price == 0) revert InvalidMember();
        Member storage m = _members[member];
        if (m.staked) revert AlreadyStaked();

        address holder = bedHolder[bedId];
        if (holder != address(0) && holder != member) revert BedTaken(bedId, holder);

        if (m.approved && m.bedId != bedId && bedHolder[m.bedId] == member) {
            delete bedHolder[m.bedId];
        }

        m.approved = true;
        m.bedId = bedId;
        m.price = price;
        bedHolder[bedId] = member;

        emit Approved(member, bedId, price);
    }

    /// @notice Withdraw an approval that hasn't been paid yet. Frees the bed.
    function revoke(address member) external onlyHost inStatus(Status.Open) {
        Member memory m = _members[member];
        if (!m.approved) revert NotApproved();
        if (m.staked) revert AlreadyStaked();

        if (bedHolder[m.bedId] == member) delete bedHolder[m.bedId];
        delete _members[member];

        emit Revoked(member, m.bedId);
    }

    /// @notice Call the city off before the deadline. Every staker can claim a full refund.
    function cancel() external onlyHost inStatus(Status.Open) {
        cancelled = true;
        emit Cancelled();
    }

    /// @notice Withdraw funds to pay for the city, with the sha256 of the receipt file.
    function withdraw(uint256 amount, bytes32 receiptHash, string calldata note)
        external
        onlyHost
        nonReentrant
        inStatus(Status.Active)
    {
        if (amount == 0 || amount > balance()) revert InvalidAmount();
        if (bytes(note).length > MAX_NOTE_LENGTH) revert NoteTooLong();

        totalWithdrawn += amount;
        usdc.safeTransfer(host, amount);

        emit Withdrawn(amount, receiptHash, note);
    }

    /// @notice End an Active city and open leftover claims. The host can close at any time;
    ///         anyone can close after the end date, so a missing host can't lock funds.
    function close() external inStatus(Status.Active) {
        if (msg.sender != host && block.timestamp < endTime) revert CloseNotAllowed();

        closed = true;
        closedBalance = balance();

        emit Closed(closedBalance);
    }

    // ------------------------------------------------------------------ members

    /// @notice Pay the approved price to hold your bed. Requires a USDC allowance.
    function stake() external nonReentrant inStatus(Status.Open) {
        Member storage m = _members[msg.sender];
        if (!m.approved) revert NotApproved();
        if (m.staked) revert AlreadyStaked();
        if (seatCount >= maxSeats) revert CityFull();

        m.staked = true;
        seatCount += 1;
        totalStaked += m.price;
        usdc.safeTransferFrom(msg.sender, address(this), m.price);

        emit Staked(msg.sender, m.bedId, m.price, seatCount);
    }

    /// @notice Full refund if the city failed or was cancelled; pro-rata leftovers once closed.
    function claim() external nonReentrant {
        uint256 amount = claimable(msg.sender);
        if (amount == 0) revert NothingToClaim();

        _members[msg.sender].claimed = true;
        usdc.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
