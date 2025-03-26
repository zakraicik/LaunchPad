// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICampaign {
    function campaignToken() external view returns (address);

    function hasClaimedFunds() external view returns (bool);

    function campaignGoalAmount() external view returns (uint256);

    function campaignDuration() external view returns (uint64);

    function campaignStartTime() external view returns (uint64);

    function campaignEndTime() external view returns (uint64);

    function totalAmountRaised() external view returns (uint256);

    function campaignId() external view returns (bytes32);

    function contributorsCount() external view returns (uint32);

    function contributions(address contributor) external view returns (uint256);

    function hasBeenRefunded(address contributor) external view returns (bool);

    function isContributor(address contributor) external view returns (bool);

    function contribute(uint256 amount) external;

    function requestRefund() external;

    function claimFunds() external;

    function claimFundsAdmin() external;

    function isCampaignActive() external view returns (bool);

    function isCampaignSuccessful() external view returns (bool);

    function isAdminOverrideActive() external view returns (bool);

    function getCampaignTokenBalance() external view returns (uint256);

    function setAdminOverride(bool _adminOverride) external;

    function adminOverride() external view returns (bool);
}
