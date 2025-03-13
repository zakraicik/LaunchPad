// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IPlatformAdmin.sol";

abstract contract PlatformAdminAccessControl {
    IPlatformAdmin public immutable platformAdmin;

    error NotAuthorizedAdmin(address sender);
    error GracePeriodNotOver(uint256 timeRemaining);

    constructor(address _platformAdmin) {
        platformAdmin = IPlatformAdmin(_platformAdmin);
    }

    modifier onlyPlatformAdmin() {
        if (!platformAdmin.platformAdmins(msg.sender))
            revert NotAuthorizedAdmin(msg.sender);
        _;
    }

    modifier onlyPlatformAdminAfterGrace() {
        if (!platformAdmin.platformAdmins(msg.sender))
            revert NotAuthorizedAdmin(msg.sender);

        (bool isGraceOver, uint256 timeRemaining) = platformAdmin
            .isGracePeriodOver(address(this));
        if (!isGraceOver) revert GracePeriodNotOver(timeRemaining);

        _;
    }
}
