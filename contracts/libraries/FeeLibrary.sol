// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FeeLibrary
 * @author Generated with assistance from an LLM
 * @dev Library for fee calculations and validations
 * @notice Provides utility functions to calculate and validate fee shares
 */
library FeeLibrary {
    /**
     * @notice Calculates the fee splits between creator and platform
     * @dev Splits a total amount based on platform fee percentage (in basis points)
     * @param totalAmount The total amount to split
     * @param platformFeePercentage Platform fee percentage in basis points (e.g., 250 = 2.5%)
     * @return creatorShare Amount allocated to the creator
     * @return platformShare Amount allocated to the platform
     */
    function calculateFeeShares(
        uint256 totalAmount,
        uint16 platformFeePercentage
    ) internal pure returns (uint256 creatorShare, uint256 platformShare) {
        // Check for overflow
        if (
            totalAmount > 0 &&
            platformFeePercentage > 0 &&
            totalAmount > type(uint256).max / platformFeePercentage
        ) {
            // Handle overflow error in the calling contract
            return (0, 0);
        }

        platformShare = (totalAmount * platformFeePercentage) / 10000;

        // Safe because platformShare is guaranteed to be <= totalAmount
        unchecked {
            creatorShare = totalAmount - platformShare;
        }

        return (creatorShare, platformShare);
    }

    /**
     * @notice Validates if a fee share is within allowed range and properly sized
     * @dev Checks if a share value fits in uint16 and is within maximum allowed share
     * @param share The share value to validate
     * @param maximumShare Maximum allowed share
     * @return isWithinRange True if share is within maximum allowed range
     * @return fitsUint16 True if share fits within uint16 type
     */
    function validateShare(
        uint256 share,
        uint16 maximumShare
    ) internal pure returns (bool isWithinRange, bool fitsUint16) {
        fitsUint16 = share <= type(uint16).max;
        isWithinRange = share <= maximumShare;
        return (isWithinRange, fitsUint16);
    }
}
