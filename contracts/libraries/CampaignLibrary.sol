// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CampaignLibrary
 * @dev Library containing helper functions for the Campaign contract
 */
library CampaignLibrary {
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

    function isCampaignSuccessful(
        uint256 totalAmountRaised,
        uint256 campaignGoalAmount
    ) internal pure returns (bool) {
        return totalAmountRaised >= campaignGoalAmount;
    }

    function calculateEndTime(
        uint256 startTime,
        uint256 durationInDays
    ) internal pure returns (uint256) {
        return startTime + (durationInDays * 1 days);
    }
}
