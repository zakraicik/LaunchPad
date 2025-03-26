//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/FeeLibrary.sol";

contract FeeManager is Ownable, PlatformAdminAccessControl {
    // Use the library
    using FeeLibrary for *;

    // Operation types
    uint8 private constant OP_TREASURY_UPDATED = 1;
    uint8 private constant OP_SHARE_UPDATED = 2;

    // Error codes
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_INVALID_SHARE = 2;
    uint8 private constant ERR_SHARE_EXCEEDS_MAXIMUM = 3;
    uint8 private constant ERR_OVERFLOW = 4;

    // State variables
    address public platformTreasury;
    uint16 public platformFeeShare = 100;
    uint16 public constant maximumFeeShare = 500;

    error FeeManagerError(uint8 code, address addr, uint256 value);

    // Consolidated events
    event FeeManagerOperation(
        uint8 opType,
        address indexed relatedAddress,
        address indexed secondaryAddress,
        uint256 primaryValue,
        uint256 secondaryValue
    );

    constructor(
        address _platformTreasury,
        address _platformAdmin,
        address _owner
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_platformTreasury == address(0)) {
            revert FeeManagerError(ERR_INVALID_ADDRESS, _platformTreasury, 0);
        }

        platformTreasury = _platformTreasury;
    }

    function updatePlatformTreasury(
        address _platformTreasury
    ) external onlyPlatformAdmin {
        if (_platformTreasury == address(0)) {
            revert FeeManagerError(ERR_INVALID_ADDRESS, _platformTreasury, 0);
        }

        address oldTreasury = platformTreasury;
        platformTreasury = _platformTreasury;

        emit FeeManagerOperation(
            OP_TREASURY_UPDATED,
            oldTreasury,
            _platformTreasury,
            0,
            0
        );
    }

    function updatePlatformFeeShare(
        uint256 _platformFeeShare
    ) external onlyPlatformAdmin {
        // Use the updated library function that returns two validation results
        (bool isWithinRange, bool fitsUint16) = FeeLibrary.validateShare(
            _platformFeeShare,
            maximumFeeShare
        );

        // Handle each validation case separately
        if (!fitsUint16) {
            revert FeeManagerError(
                ERR_INVALID_SHARE,
                address(0),
                _platformFeeShare
            );
        }

        if (!isWithinRange) {
            revert FeeManagerError(
                ERR_SHARE_EXCEEDS_MAXIMUM,
                address(0),
                _platformFeeShare
            );
        }

        // At this point, we know the value is valid and can be safely cast
        uint16 newShare = uint16(_platformFeeShare);
        uint256 oldShare = platformFeeShare;
        platformFeeShare = newShare;

        emit FeeManagerOperation(
            OP_SHARE_UPDATED,
            address(0),
            address(0),
            oldShare,
            newShare
        );
    }

    function calculateFeeShares(
        uint256 totalAmount
    ) external view returns (uint256 creatorShare, uint256 platformShare) {
        (creatorShare, platformShare) = FeeLibrary.calculateFeeShares(
            totalAmount,
            platformFeeShare
        );

        if (creatorShare == 0 && platformShare == 0 && totalAmount > 0) {
            revert FeeManagerError(ERR_OVERFLOW, address(0), totalAmount);
        }

        return (creatorShare, platformShare);
    }
}
