//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/YieldLibrary.sol";

contract YieldDistributor is Ownable, PlatformAdminAccessControl {
    // Use the library
    using YieldLibrary for *;

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
    uint16 public platformYieldShare = 10;
    uint16 public constant maximumYieldShare = 200;

    // Consolidated errors
    error YieldDistributorError(uint8 code, address addr, uint256 value);

    // Consolidated events
    event YieldDistributorOperation(
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
            revert YieldDistributorError(
                ERR_INVALID_ADDRESS,
                _platformTreasury,
                0
            );
        }

        platformTreasury = _platformTreasury;
    }

    function updatePlatformTreasury(
        address _platformTreasury
    ) external onlyPlatformAdmin {
        if (_platformTreasury == address(0)) {
            revert YieldDistributorError(
                ERR_INVALID_ADDRESS,
                _platformTreasury,
                0
            );
        }

        address oldTreasury = platformTreasury;
        platformTreasury = _platformTreasury;

        emit YieldDistributorOperation(
            OP_TREASURY_UPDATED,
            oldTreasury,
            _platformTreasury,
            0,
            0
        );
    }

    function updatePlatformYieldShare(
        uint256 _platformYieldShare
    ) external onlyPlatformAdmin {
        // Use the updated library function that returns two validation results
        (bool isWithinRange, bool fitsUint16) = YieldLibrary.validateShare(
            _platformYieldShare,
            maximumYieldShare
        );

        // Handle each validation case separately
        if (!fitsUint16) {
            revert YieldDistributorError(
                ERR_INVALID_SHARE,
                address(0),
                _platformYieldShare
            );
        }

        if (!isWithinRange) {
            revert YieldDistributorError(
                ERR_SHARE_EXCEEDS_MAXIMUM,
                address(0),
                _platformYieldShare
            );
        }

        // At this point, we know the value is valid and can be safely cast
        uint16 newShare = uint16(_platformYieldShare);
        uint256 oldShare = platformYieldShare;
        platformYieldShare = newShare;

        emit YieldDistributorOperation(
            OP_SHARE_UPDATED,
            address(0),
            address(0),
            oldShare,
            newShare
        );
    }

    function calculateYieldShares(
        uint256 totalYield
    ) external view returns (uint256 creatorShare, uint256 platformShare) {
        (creatorShare, platformShare) = YieldLibrary.calculateYieldShares(
            totalYield,
            platformYieldShare
        );

        // Check for overflow that the library detected (returned zeros)
        if (creatorShare == 0 && platformShare == 0 && totalYield > 0) {
            revert YieldDistributorError(ERR_OVERFLOW, address(0), totalYield);
        }

        return (creatorShare, platformShare);
    }
}
