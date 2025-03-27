// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FactoryLibrary
 * @author Generated with assistance from an LLM
 * @dev Library for validating campaign parameters when creating new campaigns
 * @notice Provides validation functions to ensure campaigns are created with valid parameters
 */
library FactoryLibrary {
    /**
     * @notice Validates parameters for creating a new campaign
     * @dev Checks if campaign token, goal amount, and duration are valid
     * @param campaignToken Address of the token to be used for the campaign
     * @param campaignGoalAmount The funding goal amount for the campaign
     * @param campaignDuration Duration of the campaign in days
     * @param isTokenSupported Function to check if a token is supported by the platform
     * @return True if all parameters are valid, false otherwise
     */
    function validateCampaignParams(
        address campaignToken,
        uint256 campaignGoalAmount,
        uint32 campaignDuration,
        function(address) external view returns (bool) isTokenSupported
    ) internal view returns (bool) {
        if (campaignToken == address(0)) {
            return false;
        }

        if (campaignGoalAmount <= 0) {
            return false;
        }

        if (campaignDuration <= 0 || campaignDuration > 365) {
            return false;
        }

        // Check token support with try/catch to handle possible revert
        bool isTokenValid;
        try isTokenSupported(campaignToken) returns (bool supported) {
            isTokenValid = supported;
        } catch {
            isTokenValid = false;
        }

        if (!isTokenValid) {
            return false;
        }

        return true;
    }
}
