// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CampaignLibrary
 * @dev Library containing helper functions for the Campaign contract
 */
library CampaignLibrary {
    /**
     * @dev Calculates the time-based weight for a contributor's yield share
     * @param contributionTime Timestamp of the contribution
     * @param campaignStartTime Campaign start timestamp
     * @param campaignEndTime Campaign end timestamp
     * @return Weight multiplier (scaled by 100)
     */
    // Updated calculation with higher precision and safer math
    function calculateTimeWeight(
        uint256 contributionTime,
        uint256 campaignStartTime,
        uint256 campaignEndTime
    ) internal pure returns (uint256) {
        if (contributionTime == 0) return 0;
        if (contributionTime <= campaignStartTime) return 15000; // Maximum weight if contributed at start
        if (campaignStartTime >= campaignEndTime) return 10000; // Prevent division by zero

        uint256 campaignDurationSoFar = contributionTime - campaignStartTime;
        uint256 totalDuration = campaignEndTime - campaignStartTime;

        // Use a higher precision factor for the interim calculation
        // 2^32 provides significantly more precision than 2^7
        uint256 PRECISION_FACTOR = 1 << 32;

        // Calculate percentage with higher precision, then scale down
        uint256 percentageThrough = (campaignDurationSoFar * PRECISION_FACTOR) /
            totalDuration;

        // Thresholds converted to higher precision
        uint256 QUARTER_THRESHOLD = PRECISION_FACTOR / 4; // 25%
        uint256 HALF_THRESHOLD = PRECISION_FACTOR / 2; // 50%
        uint256 THREE_QUARTER_THRESHOLD = (PRECISION_FACTOR * 3) / 4; // 75%

        // Same weight tiers but with more precise threshold calculation
        if (percentageThrough < QUARTER_THRESHOLD) {
            return 15000; // 1.5x weight
        } else if (percentageThrough < HALF_THRESHOLD) {
            return 12500; // 1.25x weight
        } else if (percentageThrough < THREE_QUARTER_THRESHOLD) {
            return 11000; // 1.1x weight
        } else {
            return 10000; // 1.0x weight
        }
    }

    /**
     * @dev Calculates yield share for a contributor based on weighted contributions
     * @param contributorWeight The weighted contribution of a specific contributor
     * @param totalWeight The total of all weighted contributions
     * @param totalYield The total amount of yield to distribute
     * @return The contributor's yield share
     */
    function calculateYieldShare(
        uint256 contributorWeight,
        uint256 totalWeight,
        uint256 totalYield
    ) internal pure returns (uint256) {
        if (contributorWeight == 0 || totalWeight == 0) {
            return 0;
        }
        return (totalYield * contributorWeight) / totalWeight;
    }

    /**
     * @dev Checks if a campaign is active based on timestamps
     * @param currentTime Current timestamp
     * @param startTime Campaign start timestamp
     * @param endTime Campaign end timestamp
     * @return True if campaign is active, false otherwise
     */
    function isCampaignActive(
        uint256 currentTime,
        uint256 startTime,
        uint256 endTime,
        bool adminOverride
    ) internal pure returns (bool) {
        if (adminOverride) {
            return false;
        }
        return (currentTime >= startTime && currentTime < endTime);
    }

    /**
     * @dev Calculates the share percentage with precision
     * @param contributorWeight The weighted contribution of a specific contributor
     * @param totalWeight The total of all weighted contributions
     * @param precision The precision factor (e.g., 10000 for 4 decimal places)
     * @return The percentage share with the specified precision
     */
    function calculateSharePercentage(
        uint256 contributorWeight,
        uint256 totalWeight,
        uint256 precision
    ) internal pure returns (uint256) {
        if (contributorWeight == 0 || totalWeight == 0) {
            return 0;
        }
        return (contributorWeight * precision) / totalWeight;
    }
}
