// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library FeeLibrary {
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

    function validateShare(
        uint256 share,
        uint16 maximumShare
    ) internal pure returns (bool isWithinRange, bool fitsUint16) {
        fitsUint16 = share <= type(uint16).max;
        isWithinRange = share <= maximumShare;
        return (isWithinRange, fitsUint16);
    }
}
