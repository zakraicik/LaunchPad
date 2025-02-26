// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICampaign {
    function contribute(uint256 amount) external returns (bool);
    function claimFunds() external returns (bool);
    function requestRefund() external returns (bool);
    function getCampaignDetails() external view returns (
        bytes32 id,
        uint256 goalAmount,
        uint16 duration,
        uint256 timeRemaining,
        uint256 remainingToGoal,
        uint256 totalRaised,
        bool isActive,
        bool claimed
    );
    function getAddressContribution() external view returns (uint256);
}