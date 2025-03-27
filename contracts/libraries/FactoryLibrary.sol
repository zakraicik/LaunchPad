// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library FactoryLibrary {
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
