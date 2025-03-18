// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IYieldDistributor {
    function calculateYieldShares(
        uint256 totalYield
    ) external view returns (uint256 creatorShare, uint256 platformShare);

    function updatePlatformTreasury(address _platformTreasury) external;

    function updatePlatformYieldShare(uint256 _platformYieldShare) external;

    function platformTreasury() external view returns (address);

    function platformYieldShare() external view returns (uint16);

    function maximumYieldShare() external view returns (uint16);
}
