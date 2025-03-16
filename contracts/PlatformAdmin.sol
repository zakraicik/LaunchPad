// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ICampaign.sol";
import "./libraries/PlatformAdminLibrary.sol";

contract PlatformAdmin is Ownable, ReentrancyGuard {
    // Use the PlatformAdminLibrary
    using PlatformAdminLibrary for *;

    // Operation types for consolidated events
    uint8 private constant OP_ADMIN_ADDED = 1;
    uint8 private constant OP_ADMIN_REMOVED = 2;
    uint8 private constant OP_GRACE_PERIOD_UPDATED = 3;

    // Error codes for consolidated errors
    uint8 private constant ERR_NOT_AUTHORIZED = 1;
    uint8 private constant ERR_INVALID_ADDRESS = 2;
    uint8 private constant ERR_INVALID_GRACE_PERIOD = 3;
    uint8 private constant ERR_ADMIN_NOT_EXISTS = 4;
    uint8 private constant ERR_ADMIN_ALREADY_EXISTS = 5;
    uint8 private constant ERR_CANT_REMOVE_OWNER = 6;

    // State variables
    uint256 public gracePeriod; // Grace period in days
    mapping(address => bool) public platformAdmins;

    // Consolidated event with operation type
    event PlatformAdminOperation(
        uint8 opType,
        address indexed admin,
        uint256 oldValue,
        uint256 newValue
    );

    // Consolidated error with error code
    error PlatformAdminError(uint8 code, address addr, uint256 value);

    constructor(uint256 _gracePeriod, address _owner) Ownable(_owner) {
        if (_gracePeriod == 0)
            revert PlatformAdminError(
                ERR_INVALID_GRACE_PERIOD,
                address(0),
                _gracePeriod
            );

        gracePeriod = _gracePeriod;

        platformAdmins[_owner] = true;
        emit PlatformAdminOperation(OP_ADMIN_ADDED, _owner, 0, 0);
    }

    modifier onlyPlatformAdmin() {
        if (!platformAdmins[msg.sender])
            revert PlatformAdminError(ERR_NOT_AUTHORIZED, msg.sender, 0);
        _;
    }

    function addPlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (_admin == address(0))
            revert PlatformAdminError(ERR_INVALID_ADDRESS, _admin, 0);
        if (platformAdmins[_admin])
            revert PlatformAdminError(ERR_ADMIN_ALREADY_EXISTS, _admin, 0);

        platformAdmins[_admin] = true;
        emit PlatformAdminOperation(OP_ADMIN_ADDED, _admin, 0, 0);
    }

    function removePlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (!platformAdmins[_admin])
            revert PlatformAdminError(ERR_ADMIN_NOT_EXISTS, _admin, 0);
        if (_admin == owner())
            revert PlatformAdminError(ERR_CANT_REMOVE_OWNER, _admin, 0);

        platformAdmins[_admin] = false;
        emit PlatformAdminOperation(OP_ADMIN_REMOVED, _admin, 0, 0);
    }

    function updateGracePeriod(uint256 _gracePeriod) external onlyOwner {
        if (_gracePeriod == 0)
            revert PlatformAdminError(
                ERR_INVALID_GRACE_PERIOD,
                address(0),
                _gracePeriod
            );

        uint256 oldPeriod = gracePeriod;
        gracePeriod = _gracePeriod;
        emit PlatformAdminOperation(
            OP_GRACE_PERIOD_UPDATED,
            address(0),
            oldPeriod,
            _gracePeriod
        );
    }

    function isGracePeriodOver(
        address _campaign
    ) external view returns (bool, uint256) {
        ICampaign campaign = ICampaign(_campaign);

        // Use library function to calculate grace period status
        return
            PlatformAdminLibrary.calculateGracePeriod(
                campaign.isCampaignActive(),
                campaign.campaignEndTime(),
                block.timestamp,
                gracePeriod
            );
    }

    function isPlatformAdmin(address account) external view returns (bool) {
        return platformAdmins[account];
    }
}
