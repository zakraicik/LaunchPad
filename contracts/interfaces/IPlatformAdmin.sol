// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPlatformAdmin {
    function platformAdmins(address admin) external view returns (bool);

    function addPlatformAdmin(address _admin) external;

    function removePlatformAdmin(address _admin) external;

    function isPlatformAdmin(address account) external view returns (bool);
}
