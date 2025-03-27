// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPlatformAdmin
 * @author Generated with assistance from an LLM
 * @dev Interface for platform administrator management
 * @notice Provides functions to add, remove, and check platform admin status
 */
interface IPlatformAdmin {
    /**
     * @notice Checks if an address is registered as a platform admin
     * @param admin Address to check admin status for
     * @return True if the address is a platform admin, false otherwise
     */
    function platformAdmins(address admin) external view returns (bool);

    /**
     * @notice Adds a new platform admin
     * @dev Can only be called by existing admins
     * @param _admin Address to add as a platform admin
     */
    function addPlatformAdmin(address _admin) external;

    /**
     * @notice Removes an existing platform admin
     * @dev Can only be called by existing admins
     * @param _admin Address to remove from platform admins
     */
    function removePlatformAdmin(address _admin) external;

    /**
     * @notice Checks if an account is a platform admin
     * @dev Alias for platformAdmins(address)
     * @param account Address to check admin status for
     * @return True if the account is a platform admin, false otherwise
     */
    function isPlatformAdmin(address account) external view returns (bool);
}
