// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IPlatformAdmin.sol";

abstract contract PlatformAdminAccessControl {
    IPlatformAdmin public immutable platformAdmin;

    error NotAuthorizedAdmin(address sender);

    constructor(address _platformAdmin) {
        platformAdmin = IPlatformAdmin(_platformAdmin);
    }

    modifier onlyPlatformAdmin() {
        if (!platformAdmin.platformAdmins(msg.sender))
            revert NotAuthorizedAdmin(msg.sender);
        _;
    }

    function isAdminOverrideActive() public view virtual returns (bool) {
        return false;
    }
}
