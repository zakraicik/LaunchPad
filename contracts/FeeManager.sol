//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/FeeLibrary.sol";

/**
 * @title FeeManager
 * @author Generated with assistance from an LLM
 * @notice Contract for managing platform fees and fee distributions
 * @dev Handles fee calculations, platform treasury management, and fee share configurations
 */
contract FeeManager is Ownable, PlatformAdminAccessControl {
    // Use the library
    using FeeLibrary for *;

    //Operation and error codes
    uint8 private constant OP_TREASURY_UPDATED = 1;
    uint8 private constant OP_SHARE_UPDATED = 2;

    //Error codes
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_INVALID_SHARE = 2;
    uint8 private constant ERR_SHARE_EXCEEDS_MAXIMUM = 3;
    uint8 private constant ERR_OVERFLOW = 4;

    //State variables
    address public platformTreasury;
    uint16 public platformFeeShare = 100;
    uint16 public constant maximumFeeShare = 500;

    /**
     * @notice Thrown when a fee manager operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     * @param value Related value (if applicable)
     */
    error FeeManagerError(uint8 code, address addr, uint256 value);

    /**
     * @notice Emitted when a fee manager operation is performed
     * @param opType Type of operation (1 = treasury updated, 2 = share updated)
     * @param relatedAddress Primary address related to the operation (e.g., old treasury address)
     * @param secondaryAddress Secondary address related to the operation (e.g., new treasury address)
     * @param primaryValue Primary value related to the operation (e.g., old fee share)
     * @param secondaryValue Secondary value related to the operation (e.g., new fee share)
     */
    event FeeManagerOperation(
        uint8 opType,
        address indexed relatedAddress,
        address indexed secondaryAddress,
        uint256 primaryValue,
        uint256 secondaryValue
    );

    /**
     * @notice Creates a new FeeManager contract
     * @dev Sets up initial treasury address and platform admin
     * @param _platformTreasury Address of the platform treasury
     * @param _platformAdmin Address of the platform admin contract
     * @param _owner Address of the contract owner
     */
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

    /**
     * @notice Updates the platform treasury address
     * @dev Only callable by platform admins
     * @param _platformTreasury New address for the platform treasury
     */
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

    /**
     * @notice Updates the platform fee share percentage
     * @dev Only callable by platform admins
     * @param _platformFeeShare New platform fee share in basis points (e.g., 100 = 1%)
     */
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

    /**
     * @notice Calculates fee shares between creator and platform
     * @dev Uses FeeLibrary to perform the calculation and checks for overflow
     * @param totalAmount The total amount to split
     * @return creatorShare Amount allocated to the creator
     * @return platformShare Amount allocated to the platform
     */
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
