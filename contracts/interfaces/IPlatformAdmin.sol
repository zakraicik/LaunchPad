// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPlatformAdmin
 * @notice Interface for the PlatformAdmin contract to be used by other contracts
 */
interface IPlatformAdmin {
    function gracePeriod() external view returns (uint256);

    function platformAdmins(address admin) external view returns (bool);

    function addPlatformAdmin(address _admin) external;

    function removePlatformAdmin(address _admin) external;

    function updateGracePeriod(uint256 _gracePeriod) external;

    function isGracePeriodOver(
        address _campaign
    ) external view returns (bool, uint256);
}
