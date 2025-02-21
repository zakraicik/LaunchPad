// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IYieldDistributor {
    function calculateYieldShares(uint256 totalYield) external view returns (uint256 creatorShare, uint256 platformShare);
    function getPlatformTreasury() external view returns (address);
    function getPlatformYieldShare() external view returns (uint256);
    function getYieldSplitPreview(uint256 yieldAmount) external view returns (uint256 creatorAmount, uint256 platformAmount);
}