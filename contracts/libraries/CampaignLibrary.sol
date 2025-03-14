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
    function calculateTimeWeight(
        uint256 contributionTime,
        uint256 campaignStartTime,
        uint256 campaignEndTime
    ) internal pure returns (uint256) {
        if (contributionTime == 0) return 0;

        uint256 campaignDurationSoFar = contributionTime - campaignStartTime;
        uint256 totalDuration = campaignEndTime - campaignStartTime;

        // Optimize with bitshift instead of multiplication by 100
        uint256 percentageThrough = (campaignDurationSoFar << 7) /
            totalDuration;

        if (percentageThrough < 32) {
            // ~25% of 128
            return 150; // 1.5x weight
        } else if (percentageThrough < 64) {
            // ~50% of 128
            return 125; // 1.25x weight
        } else if (percentageThrough < 96) {
            // ~75% of 128
            return 110; // 1.1x weight
        } else {
            return 100; // 1.0x weight (no bonus)
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
        uint256 endTime
    ) internal pure returns (bool) {
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
