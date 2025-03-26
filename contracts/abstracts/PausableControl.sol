// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PlatformAdminAccessControl.sol";

abstract contract PausableControl is Pausable, PlatformAdminAccessControl {
    uint8 private constant OP_PAUSED = 1;
    uint8 private constant OP_UNPAUSED = 2;

    event PauseOperation(
        uint8 indexed opType,
        address indexed admin,
        uint256 timestamp
    );

    error PlatformPaused();

    function pause() external onlyPlatformAdmin {
        _pause();
        emit PauseOperation(OP_PAUSED, msg.sender, block.timestamp);
    }

    function unpause() external onlyPlatformAdmin {
        _unpause();
        emit PauseOperation(OP_UNPAUSED, msg.sender, block.timestamp);
    }

    function _beforeOperation() internal view virtual {
        if (paused()) {
            revert PlatformPaused();
        }
    }
}
