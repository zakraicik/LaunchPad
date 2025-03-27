// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IPlatformAdmin.sol";

/**
 * @title PlatformAdminAccessControl
 * @author Generated with assistance from an LLM
 * @dev Abstract contract that provides access control functionality based on platform admin status
 * @notice Implements a mechanism to restrict function access to platform administrators only
 */
abstract contract PlatformAdminAccessControl {
    /**
     * @notice Reference to the platform admin contract that maintains the list of authorized admins
     * @dev Immutable variable that cannot be changed after deployment
     */
    IPlatformAdmin public immutable platformAdmin;

    /**
     * @notice Error thrown when a non-admin address attempts to access an admin-only function
     * @param sender Address that attempted the unauthorized access
     */
    error NotAuthorizedAdmin(address sender);

    /**
     * @notice Sets the platform admin contract address during deployment
     * @dev The platform admin address is immutable and cannot be changed after construction
     * @param _platformAdmin Address of the IPlatformAdmin contract
     */
    constructor(address _platformAdmin) {
        platformAdmin = IPlatformAdmin(_platformAdmin);
    }

    /**
     * @notice Modifier that restricts function access to platform admins only
     * @dev Checks if the sender is registered as a platform admin in the platformAdmin contract
     * @dev Reverts with NotAuthorizedAdmin error if the sender is not a platform admin
     */
    modifier onlyPlatformAdmin() {
        if (!platformAdmin.platformAdmins(msg.sender))
            revert NotAuthorizedAdmin(msg.sender);
        _;
    }

    /**
     * @notice Checks if admin override functionality is active
     * @dev This is a virtual function that returns false by default
     * @dev Can be overridden by inheriting contracts to implement custom override logic
     * @return bool True if admin override is active, false otherwise
     */
    function isAdminOverrideActive() public view virtual returns (bool) {
        return false;
    }
}
