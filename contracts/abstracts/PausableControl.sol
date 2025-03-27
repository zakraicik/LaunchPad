// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PlatformAdminAccessControl.sol";

/**
 * @title PausableControl
 * @author Generated with assistance from an LLM
 * @dev Abstract contract that provides platform-wide pause functionality
 * This contract extends OpenZeppelin's Pausable and combines it with
 * platform-specific admin access control to create an emergency stop mechanism.
 * Contracts that inherit from this can use the whenNotPaused modifier
 * from OpenZeppelin's Pausable or can call _beforeOperation() directly.
 */
abstract contract PausableControl is Pausable, PlatformAdminAccessControl {
    //Operation codes
    uint8 private constant OP_PAUSED = 1;
    uint8 private constant OP_UNPAUSED = 2;

    /**
     * @dev Emitted when pause state changes
     * @param opType The operation type (1 for pause, 2 for unpause)
     * @param admin Address of the admin who performed the action
     * @param timestamp Block timestamp when the operation occurred
     */
    event PauseOperation(
        uint8 indexed opType,
        address indexed admin,
        uint256 timestamp
    );

    /**
     * @dev Thrown when an operation is attempted while the contract is paused
     */
    error PlatformPaused();

    /**
     * @dev Pauses the contract
     * All functions with the `whenNotPaused` modifier will be disabled
     * Can only be called by a platform admin
     */
    function pause() external onlyPlatformAdmin {
        _pause();
        emit PauseOperation(OP_PAUSED, msg.sender, block.timestamp);
    }

    /**
     * @dev Unpauses the contract
     * Re-enables functions with the `whenNotPaused` modifier
     * Can only be called by a platform admin
     */
    function unpause() external onlyPlatformAdmin {
        _unpause();
        emit PauseOperation(OP_UNPAUSED, msg.sender, block.timestamp);
    }

    /**
     * @dev Internal function to be called before operations that should be paused
     * Can be used directly in functions as an alternative to the whenNotPaused modifier
     * Reverts with PlatformPaused if the contract is paused
     */
    function _beforeOperation() internal view virtual {
        if (paused()) {
            revert PlatformPaused();
        }
    }
}
