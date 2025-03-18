// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title YieldLibrary
 * @dev Library for yield calculations to reduce bytecode size
 */
library YieldLibrary {
    /**
     * @dev Calculates the creator and platform shares of the yield
     * @param totalYield The total yield amount to distribute
     * @param platformYieldShare The platform's percentage share (basis points, e.g. 2000 = 20%)
     * @return creatorShare The creator's portion of the yield
     * @return platformShare The platform's portion of the yield
     */
    function calculateYieldShares(
        uint256 totalYield,
        uint16 platformYieldShare
    ) internal pure returns (uint256 creatorShare, uint256 platformShare) {
        // Check for overflow
        if (
            totalYield > 0 &&
            platformYieldShare > 0 &&
            totalYield > type(uint256).max / platformYieldShare
        ) {
            // Handle overflow error in the calling contract
            return (0, 0);
        }

        platformShare = (totalYield * platformYieldShare) / 10000;

        // Safe because platformShare is guaranteed to be <= totalYield
        unchecked {
            creatorShare = totalYield - platformShare;
        }

        return (creatorShare, platformShare);
    }

    /**
     * @dev Validates if a share percentage is within valid limits
     * @param share The share percentage to validate (in basis points)
     * @param maximumShare The maximum allowed share (in basis points)
     * @return isWithinRange True if the share is within the allowed range
     * @return fitsUint16 True if the share can be safely cast to uint16
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
