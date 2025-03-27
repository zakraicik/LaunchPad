// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IFeeManager
 * @author Generated with assistance from an LLM
 * @dev Interface for managing platform fees
 * @notice Handles fee calculations and fee-related settings for the platform
 */
interface IFeeManager {
    /**
     * @notice Calculates the fee shares between creator and platform
     * @dev Splits a total amount into creator and platform shares based on configured fee percentages
     * @param totalAmount The total amount to split
     * @return creatorShare Amount allocated to the creator
     * @return platformShare Amount allocated to the platform
     */
    function calculateFeeShares(
        uint256 totalAmount
    ) external view returns (uint256 creatorShare, uint256 platformShare);

    /**
     * @notice Updates the platform treasury address
     * @dev Only callable by authorized admins
     * @param _platformTreasury New address for the platform treasury
     */
    function updatePlatformTreasury(address _platformTreasury) external;

    /**
     * @notice Updates the platform's fee share percentage
     * @dev Only callable by authorized admins
     * @param _platformFeeShare New platform fee share (basis points)
     */
    function updatePlatformFeeShare(uint256 _platformFeeShare) external;

    /**
     * @notice Returns the current platform treasury address
     * @return Address of the platform treasury
     */
    function platformTreasury() external view returns (address);

    /**
     * @notice Returns the current platform fee share percentage
     * @return Platform fee share in basis points (e.g., 250 = 2.5%)
     */
    function platformFeeShare() external view returns (uint16);

    /**
     * @notice Returns the maximum allowed fee share percentage
     * @return Maximum fee share in basis points (e.g., 1000 = 10%)
     */
    function maximumFeeShare() external view returns (uint16);
}
