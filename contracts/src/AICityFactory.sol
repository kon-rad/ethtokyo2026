// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PopupCity, CityParams} from "./PopupCity.sol";

/// @title AICityFactory
/// @notice Launches pop-up cities. Each city is its own PopupCity contract, so funds never mix.
contract AICityFactory {
    IERC20 public immutable usdc;
    address[] private _cities;

    event CityCreated(
        address indexed city,
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

    function createCity(CityParams calldata p) external returns (address city) {
        city = address(new PopupCity(msg.sender, usdc, p));
        _cities.push(city);
        emit CityCreated(city, msg.sender, p.metadataHash, p.startTime, p.endTime, p.deadline, p.minSeats, p.maxSeats);
    }

    function citiesLength() external view returns (uint256) {
        return _cities.length;
    }

    function cityAt(uint256 index) external view returns (address) {
        return _cities[index];
    }
}
