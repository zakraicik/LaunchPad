// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IEventCollector
 * @notice Interface for the EventCollector contract
 * @dev Defines methods that Campaign contracts can call to emit events
 */
interface ICampaignEventCollector {
    /**
     * @notice Authorizes a factory contract to register campaigns
     * @param factoryAddress Address of the factory contract to authorize
     */
    function authorizeFactory(address factoryAddress) external;

    /**
     * @notice Revokes authorization from a factory contract
     * @param factoryAddress Address of the factory contract to deauthorize
     */
    function deauthorizeFactory(address factoryAddress) external;

    /**
     * @notice Authorizes a Campaign contract to emit events through this collector
     * @dev Can be called by authorized factories
     * @param campaignAddress Address of the Campaign contract to authorize
     */
    function authorizeCampaignFromFactory(address campaignAddress) external;

    /**
     * @notice Revokes authorization from a Campaign contract
     * @param campaignAddress Address of the Campaign contract to deauthorize
     */
    function deauthorizeCampaign(address campaignAddress) external;

    /**
     * @notice Emits a Contribution event
     * @param contributor Address of the contributor
     * @param amount Amount contributed
     * @param campaignId Unique identifier of the campaign
     */
    function emitContribution(
        address contributor,
        uint256 amount,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits a RefundIssued event
     * @param contributor Address of the contributor receiving the refund
     * @param amount Amount refunded
     * @param campaignId Unique identifier of the campaign
     */
    function emitRefundIssued(
        address contributor,
        uint256 amount,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits a FundsClaimed event
     * @param initiator Address that initiated the claim
     * @param amount Amount claimed
     * @param campaignId Unique identifier of the campaign
     */
    function emitFundsClaimed(
        address initiator,
        uint256 amount,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits a CampaignStatusChanged event
     * @param oldStatus Previous status
     * @param newStatus New status
     * @param reason Reason code for the status change
     * @param campaignId Unique identifier of the campaign
     */
    function emitCampaignStatusChanged(
        uint8 oldStatus,
        uint8 newStatus,
        uint8 reason,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits an AdminOverrideSet event
     * @param status New override status
     * @param admin Admin who made the change
     * @param campaignId Unique identifier of the campaign
     */
    function emitAdminOverrideSet(
        bool status,
        address admin,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits a FundsOperation event
     * @param token Token address
     * @param amount Amount involved in the operation
     * @param opType Operation type
     * @param initiator Address that initiated the operation
     * @param campaignId Unique identifier of the campaign
     */
    function emitFundsOperation(
        address token,
        uint256 amount,
        uint8 opType,
        address initiator,
        bytes32 campaignId
    ) external;

    /**
     * @notice Emits a CampaignStatusChanged event from a factory
     * @dev Only callable by authorized factories
     * @param oldStatus Previous status
     * @param newStatus New status
     * @param reason Reason code for the status change
     * @param campaignId Unique identifier of the campaign
     * @param campaignAddress Address of the campaign contract
     */
    function emitCampaignStatusChangedFromFactory(
        uint8 oldStatus,
        uint8 newStatus,
        uint8 reason,
        bytes32 campaignId,
        address campaignAddress
    ) external;
}
