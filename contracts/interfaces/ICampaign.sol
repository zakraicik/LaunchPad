// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ICampaign
 * @author Generated with assistance from an LLM
 * @dev Interface for crowdfunding campaign functionality
 * @notice Defines the standard methods for campaign management, contribution handling, and fund distribution
 */
interface ICampaign {
    /**
     * @notice Returns the address of the token used for campaign contributions
     * @return Address of the campaign token
     */
    function campaignToken() external view returns (address);

    /**
     * @notice Checks if campaign funds have been claimed by creator
     * @return True if funds have been claimed, false otherwise
     */
    function hasClaimedFunds() external view returns (bool);

    /**
     * @notice Returns the campaign's funding goal amount
     * @return The funding goal amount in campaign tokens
     */
    function campaignGoalAmount() external view returns (uint256);

    /**
     * @notice Returns the total duration of the campaign in seconds
     * @return Campaign duration in seconds
     */
    function campaignDuration() external view returns (uint64);

    /**
     * @notice Returns the timestamp when the campaign started
     * @return UNIX timestamp of the campaign start time
     */
    function campaignStartTime() external view returns (uint64);

    /**
     * @notice Returns the timestamp when the campaign will end
     * @return UNIX timestamp of the campaign end time
     */
    function campaignEndTime() external view returns (uint64);

    /**
     * @notice Returns the total amount raised by the campaign
     * @return Total amount raised in campaign tokens
     */
    function totalAmountRaised() external view returns (uint256);

    /**
     * @notice Returns the unique identifier for this campaign
     * @return The campaign ID
     */
    function campaignId() external view returns (bytes32);

    /**
     * @notice Returns the total number of unique contributors to the campaign
     * @return Count of unique contributors
     */
    function contributorsCount() external view returns (uint32);

    /**
     * @notice Returns the amount contributed by a specific address
     * @param contributor Address of the contributor
     * @return Amount contributed by the specified address
     */
    function contributions(address contributor) external view returns (uint256);

    /**
     * @notice Checks if a contributor has already been refunded
     * @param contributor Address of the contributor
     * @return True if the contributor has been refunded, false otherwise
     */
    function hasBeenRefunded(address contributor) external view returns (bool);

    /**
     * @notice Checks if an address has contributed to the campaign
     * @param contributor Address to check
     * @return True if the address has contributed, false otherwise
     */
    function isContributor(address contributor) external view returns (bool);

    /**
     * @notice Allows a user to contribute to the campaign
     * @dev User must have approved the token transfer
     * @param amount Amount to contribute in campaign tokens
     */
    function contribute(uint256 amount) external;

    /**
     * @notice Allows a contributor to request a refund if campaign is unsuccessful
     * @dev Only available if campaign did not reach its goal
     */
    function requestRefund() external;

    /**
     * @notice Allows the campaign creator to claim raised funds if campaign is successful
     * @dev Only available if campaign reached its goal
     */
    function claimFunds() external;

    /**
     * @notice Allows platform admins to claim funds on behalf of the creator
     * @dev Only available to platform admins
     */
    function claimFundsAdmin() external;

    /**
     * @notice Checks if the campaign is currently active
     * @return True if campaign is within its active timeframe, false otherwise
     */
    function isCampaignActive() external view returns (bool);

    /**
     * @notice Checks if the campaign has successfully reached its funding goal
     * @return True if campaign goal was reached, false otherwise
     */
    function isCampaignSuccessful() external view returns (bool);

    /**
     * @notice Checks if admin override is currently active for this campaign
     * @return True if admin override is active, false otherwise
     */
    function isAdminOverrideActive() external view returns (bool);

    /**
     * @notice Returns the current balance of campaign tokens held by the contract
     * @return Current balance of campaign tokens
     */
    function getCampaignTokenBalance() external view returns (uint256);

    /**
     * @notice Sets the admin override status for the campaign
     * @dev Only callable by authorized admins
     * @param _adminOverride New override status to set
     */
    function setAdminOverride(bool _adminOverride) external;

    /**
     * @notice Returns the current admin override status
     * @return Current admin override status
     */
    function adminOverride() external view returns (bool);

    /**
     * @notice Returns the current campaign status
     * @return Status code (1=active, 2=complete)
     */
    function campaignStatus() external view returns (uint8);

    /**
     * @notice Checks and updates the campaign status if needed
     * @dev Updates status to complete if deadline passed without reaching goal
     * @return Current campaign status after potential update
     */
    function checkAndUpdateStatus() external returns (uint8);
}
