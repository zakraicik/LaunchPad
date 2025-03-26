// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFeeManager {
    function calculateFeeShares(
        uint256 totalAmount
    ) external view returns (uint256 creatorShare, uint256 platformShare);

    function updatePlatformTreasury(address _platformTreasury) external;

    function updatePlatformFeeShare(uint256 _platformFeeShare) external;

    function platformTreasury() external view returns (address);

    function platformFeeShare() external view returns (uint16);

    function maximumFeeShare() external view returns (uint16);
}
