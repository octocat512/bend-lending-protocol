// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {DataTypes} from "../libraries/types/DataTypes.sol";
import {ReserveLogic} from "../libraries/logic/ReserveLogic.sol";

contract LendPoolStorage {
    using ReserveLogic for DataTypes.ReserveData;

    mapping(address => DataTypes.ReserveData) internal _reserves;
    mapping(uint256 => address) internal _reservesList;
    uint256 internal _reservesCount;

    bool internal _paused;

    uint256 internal _maxNumberOfReserves;
}
