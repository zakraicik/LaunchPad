// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICampaign {
    function campaignToken() external view returns (address);

    function isClaimed() external view returns (bool);

    function campaignGoalAmount() external view returns (uint256);

    function campaignDuration() external view returns (uint256);

    function campaignStartTime() external view returns (uint256);

    function campaignEndTime() external view returns (uint256);

    function totalAmountRaised() external view returns (uint256);

    function campaignId() external view returns (bytes32);

    function contributions(address contributor) external view returns (uint256);

    function hasBeenRefunded(address contributor) external view returns (bool);

    function contribute(address fromToken, uint256 amount) external;

    function requestRefund() external;

    function claimFunds() external;

    function isCampaignActive() external view returns (bool);

    function isCampaignSuccessful() external view returns (bool);

    function depositToYieldProtocol(address token, uint256 amount) external;

    function harvestYield(address token) external;

    function withdrawAllFromYieldProtocol(address token) external;

    function withdrawFromYieldProtocol(address token, uint256 amount) external;

    function getDepositedAmount(address token) external view returns (uint256);

    function getCurrentYieldRate(address token) external view returns (uint256);
}
