// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FactoryLibrary
 * @dev Library containing helper functions for the CampaignContractFactory
 */
library FactoryLibrary {
    /**
     * @dev Validates campaign creation parameters
     * @param campaignToken Address of the token being collected
     * @param campaignGoalAmount Goal amount to raise
     * @param campaignDuration Duration of campaign in days
     * @param tokenRegistry Address of the token registry contract
     * @param isTokenSupported Function to check if a token is supported
     * @return A boolean indicating if the parameters are valid
     */
    function validateCampaignParams(
        address campaignToken,
        uint256 campaignGoalAmount,
        uint16 campaignDuration,
        address tokenRegistry,
        function(address) external view returns (bool) isTokenSupported
    ) internal view returns (bool) {
        if (campaignToken == address(0)) {
            return false;
        }

        if (!isTokenSupported(campaignToken)) {
            return false;
        }

        if (campaignGoalAmount <= 0) {
            return false;
        }

        if (campaignDuration <= 0) {
            return false;
        }

        return true;
    }
}
