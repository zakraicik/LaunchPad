// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CampaignLibrary
 * @author Generated with assistance from an LLM
 * @dev Library containing helper functions for the Campaign contract
 * @notice Provides utility functions for campaign status checks and time calculations
 */
library CampaignLibrary {
    /**
     * @notice Checks if a campaign is currently active
     * @dev A campaign is active if the current time is between start and end times, and admin override is not active
     * @param currentTime Current timestamp
     * @param startTime Campaign start timestamp
     * @param endTime Campaign end timestamp
     * @param adminOverride Whether admin override is active
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
     * @notice Checks if a campaign has successfully reached its funding goal
     * @dev A campaign is successful if the total amount raised equals or exceeds the goal amount
     * @param totalAmountRaised Total amount of tokens raised so far
     * @param campaignGoalAmount Campaign's funding goal amount
     * @return True if campaign is successful, false otherwise
     */
    function isCampaignSuccessful(
        uint256 totalAmountRaised,
        uint256 campaignGoalAmount
    ) internal pure returns (bool) {
        return totalAmountRaised >= campaignGoalAmount;
    }

    /**
     * @notice Calculates the campaign end time based on start time and duration
     * @dev Converts duration from days to seconds and adds to start time
     * @param startTime Campaign start timestamp
     * @param durationInDays Campaign duration in days
     * @return End timestamp for the campaign
     */
    function calculateEndTime(
        uint256 startTime,
        uint256 durationInDays
    ) internal pure returns (uint256) {
        return startTime + (durationInDays * 1 days);
    }
}
