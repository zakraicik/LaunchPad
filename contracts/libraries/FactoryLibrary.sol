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
