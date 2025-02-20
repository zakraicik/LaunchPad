// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITokenRegistry {
    function isTokenSupported(address token) external view returns (bool);
    function getMinContributionAmount(address token) external view returns (uint256);
    function getAllSupportedTokens() external view returns(address[] memory);
    function getWETH() external view returns (address);
}