// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PlatformAdminLibrary
 * @dev Library containing helper functions for the PlatformAdmin contract
 */
library PlatformAdminLibrary {
    /**
     * @dev Calculate grace period status and remaining time
     * @param campaignActive Whether the campaign is still active
     * @param campaignEndTime Campaign end timestamp
     * @param currentTime Current timestamp (usually block.timestamp)
     * @param gracePeriodDays Grace period in days
     * @return isOver Whether the grace period is over
     * @return timeRemaining Time remaining in seconds until grace period ends
     */
    function calculateGracePeriod(
        bool campaignActive,
        uint256 campaignEndTime,
        uint256 currentTime,
        uint256 gracePeriodDays
    ) internal pure returns (bool isOver, uint256 timeRemaining) {
        // Convert grace period from days to seconds
        uint256 gracePeriodSeconds = gracePeriodDays * 1 days;

        if (campaignActive) {
            // If campaign is still active, calculate remaining time
            uint256 campaignTimeRemaining = 0;
            if (campaignEndTime > currentTime) {
                campaignTimeRemaining = campaignEndTime - currentTime;
            }

            // Total remaining time is campaign time + grace period
            timeRemaining = campaignTimeRemaining + gracePeriodSeconds;
            return (false, timeRemaining);
        } else {
            // If campaign has ended, check if grace period is over
            uint256 gracePeriodEnd = campaignEndTime + gracePeriodSeconds;
            isOver = currentTime >= gracePeriodEnd;

            if (isOver) {
                return (true, 0);
            } else {
                timeRemaining = gracePeriodEnd - currentTime;
                return (false, timeRemaining);
            }
        }
    }
}
