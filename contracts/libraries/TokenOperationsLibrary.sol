// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TokenOperations
 * @dev Library for common token operations to reduce bytecode size
 */
library TokenOperations {
    using SafeERC20 for IERC20;

    /**
     * @dev Safely transfers tokens from a sender to a recipient
     * @param token The token to transfer
     * @param from The sender address
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        IERC20(token).safeTransferFrom(from, to, amount);
    }

    /**
     * @dev Safely increases allowance for a spender
     * @param token The token to approve
     * @param spender The address to approve
     * @param amount The amount to approve
     */
    function safeIncreaseAllowance(
        address token,
        address spender,
        uint256 amount
    ) internal {
        IERC20(token).safeIncreaseAllowance(spender, amount);
    }

    /**
     * @dev Safely transfers tokens to a recipient
     * @param token The token to transfer
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function safeTransfer(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @dev Gets the balance of tokens for an account
     * @param token The token to check
     * @param account The account to check
     * @return The token balance
     */
    function getBalance(
        address token,
        address account
    ) internal view returns (uint256) {
        return IERC20(token).balanceOf(account);
    }
}
