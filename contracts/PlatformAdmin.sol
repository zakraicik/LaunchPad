// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ICampaign.sol";

/**
 * @title PlatformAdmin
 * @author Generated with assistance from an LLM
 * @notice Contract for managing platform administrators
 * @dev Implements administrator access control for the platform
 */
contract PlatformAdmin is Ownable, ReentrancyGuard {
    // Operation types for consolidated events
    /**
     * @dev Constant defining admin addition operation type for events
     */
    uint8 private constant OP_ADMIN_ADDED = 1;

    /**
     * @dev Constant defining admin removal operation type for events
     */
    uint8 private constant OP_ADMIN_REMOVED = 2;

    // Error codes for consolidated errors
    /**
     * @dev Error code for unauthorized access
     */
    uint8 private constant ERR_NOT_AUTHORIZED = 1;

    /**
     * @dev Error code for invalid address
     */
    uint8 private constant ERR_INVALID_ADDRESS = 2;

    /**
     * @dev Error code for non-existent admin
     */
    uint8 private constant ERR_ADMIN_NOT_EXISTS = 3;

    /**
     * @dev Error code for already existing admin
     */
    uint8 private constant ERR_ADMIN_ALREADY_EXISTS = 4;

    /**
     * @dev Error code for attempts to remove the owner from admin role
     */
    uint8 private constant ERR_CANT_REMOVE_OWNER = 5;

    /**
     * @notice Mapping of addresses to their admin status
     * @dev True if address is a platform admin, false otherwise
     */
    mapping(address => bool) public platformAdmins;

    /**
     * @notice Emitted when a platform admin operation is performed
     * @param opType Type of operation (1 = admin added, 2 = admin removed)
     * @param admin Address of the admin involved in the operation
     * @param oldValue Previous value (if applicable)
     * @param newValue New value (if applicable)
     */
    event PlatformAdminOperation(
        uint8 opType,
        address indexed admin,
        uint256 oldValue,
        uint256 newValue
    );

    /**
     * @notice Thrown when a platform admin operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     * @param value Related value (if applicable)
     */
    error PlatformAdminError(uint8 code, address addr, uint256 value);

    /**
     * @notice Initializes the PlatformAdmin contract
     * @dev Sets the contract owner as the initial platform admin
     * @param _owner Address of the contract owner and initial admin
     */
    constructor(address _owner) Ownable(_owner) {
        platformAdmins[_owner] = true;
        emit PlatformAdminOperation(OP_ADMIN_ADDED, _owner, 0, 0);
    }

    /**
     * @notice Restricts function access to platform admins only
     * @dev Reverts with NOT_AUTHORIZED error if caller is not a platform admin
     */
    modifier onlyPlatformAdmin() {
        if (!platformAdmins[msg.sender])
            revert PlatformAdminError(ERR_NOT_AUTHORIZED, msg.sender, 0);
        _;
    }

    /**
     * @notice Adds a new platform administrator
     * @dev Only callable by existing platform admins
     * @param _admin Address to add as a platform admin
     */
    function addPlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (_admin == address(0))
            revert PlatformAdminError(ERR_INVALID_ADDRESS, _admin, 0);
        if (platformAdmins[_admin])
            revert PlatformAdminError(ERR_ADMIN_ALREADY_EXISTS, _admin, 0);

        platformAdmins[_admin] = true;
        emit PlatformAdminOperation(OP_ADMIN_ADDED, _admin, 0, 0);
    }

    /**
     * @notice Removes an existing platform administrator
     * @dev Only callable by existing platform admins, cannot remove the owner
     * @param _admin Address to remove from platform admins
     */
    function removePlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (!platformAdmins[_admin])
            revert PlatformAdminError(ERR_ADMIN_NOT_EXISTS, _admin, 0);
        if (_admin == owner())
            revert PlatformAdminError(ERR_CANT_REMOVE_OWNER, _admin, 0);

        platformAdmins[_admin] = false;
        emit PlatformAdminOperation(OP_ADMIN_REMOVED, _admin, 0, 0);
    }

    /**
     * @notice Checks if an account is a platform admin
     * @param account Address to check admin status for
     * @return True if the account is a platform admin, false otherwise
     */
    function isPlatformAdmin(address account) external view returns (bool) {
        return platformAdmins[account];
    }
}
