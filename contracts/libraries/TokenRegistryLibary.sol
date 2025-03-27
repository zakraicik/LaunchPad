// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title TokenRegistryLibrary
 * @author Generated with assistance from an LLM
 * @dev Library for token registry operations and unit conversions
 */
library TokenRegistryLibrary {
    /**
     * @dev Convert an amount from whole tokens to the smallest unit (e.g., wei) based on decimals
     * @param amount Amount in whole tokens
     * @param decimals Token decimals
     * @return Amount in smallest unit
     */
    function convertToSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (amount > type(uint256).max / (10 ** decimals)) {
            return 0; // Caller should check for 0 and handle overflow error
        }
        return amount * (10 ** decimals);
    }

    /**
     * @dev Convert an amount from smallest unit to whole tokens
     * @param amount Amount in smallest unit
     * @param decimals Token decimals
     * @return Amount in whole tokens
     */
    function convertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256) {
        return amount / (10 ** decimals);
    }

    /**
     * @dev Validate if an address is a valid ERC20 token and return its decimals
     * @param token Address to validate
     * @return decimals The token's decimals
     * @return isValid Whether the token is valid
     */
    function validateAndGetDecimals(
        address token
    ) internal view returns (uint8 decimals, bool isValid) {
        if (token == address(0)) {
            return (0, false);
        }

        // Check if address is a contract
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(token)
        }
        if (codeSize == 0) {
            return (0, false);
        }

        // Try to get decimals from the token
        try IERC20Metadata(token).decimals() returns (uint8 _decimals) {
            return (_decimals, true);
        } catch {
            return (0, false);
        }
    }

    /**
     * @dev Find and remove an address from an array
     * @param array Array to modify
     * @param value Value to remove
     * @return success Whether the value was found and removed
     */
    function removeFromArray(
        address[] storage array,
        address value
    ) internal returns (bool success) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                // Move the last element to the position of the element to delete
                array[i] = array[array.length - 1];
                // Remove the last element
                array.pop();
                return true;
            }
        }
        return false;
    }
}
