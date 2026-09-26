// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Residency, ResidencyParams} from "./Residency.sol";

/// @title ResidencyFactory
/// @notice Launches residencies. Each residency is its own Residency contract, so funds never mix.
///         A residency belongs to one pop-up city; the city id is part of its hashed metadata.
contract ResidencyFactory {
    IERC20 public immutable usdc;
    address[] private _residencies;

    event ResidencyCreated(
        address indexed residency,
        address indexed host,
        bytes32 indexed metadataHash,
        uint64 startTime,
        uint64 endTime,
        uint64 deadline,
        uint32 minSeats,
        uint32 maxSeats
    );

    constructor(IERC20 usdc_) {
        require(address(usdc_) != address(0), "usdc");
        usdc = usdc_;
    }

    function createResidency(ResidencyParams calldata p) external returns (address residency) {
        residency = address(new Residency(msg.sender, usdc, p));
        _residencies.push(residency);
        emit ResidencyCreated(
            residency, msg.sender, p.metadataHash, p.startTime, p.endTime, p.deadline, p.minSeats, p.maxSeats
        );
    }

    function residenciesLength() external view returns (uint256) {
        return _residencies.length;
    }

    function residencyAt(uint256 index) external view returns (address) {
        return _residencies[index];
    }
}
