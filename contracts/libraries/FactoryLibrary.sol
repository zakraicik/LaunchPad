// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FactoryLibrary
 * @dev Library containing helper functions for the CampaignContractFactory
 */
library FactoryLibrary {
    function validateCampaignParams(
        address campaignToken,
        uint256 campaignGoalAmount,
        uint16 campaignDuration,
        function(address) external view returns (bool) isTokenSupported
    ) internal view returns (bool) {
        // First check basic parameters
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
        try isTokenSupported(campaignToken) returns (bool supported) {
            if (!supported) {
                return false;
            }
        } catch {
            return false;
        }

        return true;
    }
}
