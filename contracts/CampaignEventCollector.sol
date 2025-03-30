// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

/**
 * @title EventCollector
 * @author Your Name
 * @notice Proxy contract for centralizing events from multiple Campaign contracts
 * @dev Collects events from various Campaign contracts and re-emits them from a single address
 */
contract CampaignEventCollector is Ownable, PlatformAdminAccessControl {
    mapping(address => bool) public authorizedFactories;
    mapping(address => bool) public authorizedCampaigns;

    //Operatio codes
    uint8 private constant OP_FACTORY_AUTHORIZED = 1;
    uint8 private constant OP_FACTORY_DEAUTHORIZED = 2;
    uint8 private constant OP_CAMPAIGN_AUTHORIZED = 3;
    uint8 private constant OP_CAMPAIGN_DEAUTHORIZED = 4;

    //Error Codes
    uint8 private constant ERR_ZERO_ADDRESS = 1;
    uint8 private constant ERR_FACTORY_NOT_AUTHORIZED = 2;
    uint8 private constant ERR_FACTORY_DOES_NOT_EXIST = 3;
    uint8 private constant ERR_CAMPAIGN_NOT_AUTHORIZED = 4;
    uint8 private constant ERR_CAMPAIGN_DOES_NOT_EXIST = 5;

    event CampaignEventCollectorOperation(
        uint8 opType,
        address indexed sender,
        address indexed targetAddress
    );
    error CampaignEventCollectorError(uint8 errCode, address addr);

    /**
     * @notice Events mirroring those in the Campaign contract
     */
    event Contribution(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed campaignId,
        address indexed campaignAddress
    );

    event RefundIssued(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed campaignId,
        address indexed campaignAddress
    );

    event FundsClaimed(
        address indexed initiator,
        uint256 amount,
        bytes32 indexed campaignId,
        address indexed campaignAddress
    );

    event CampaignStatusChanged(
        uint8 oldStatus,
        uint8 newStatus,
        uint8 reason,
        bytes32 indexed campaignId,
        address indexed campaignAddress
    );

    event AdminOverrideSet(
        bool indexed status,
        address indexed admin,
        bytes32 indexed campaignId,
        address campaignAddress
    );

    event FundsOperation(
        address indexed token,
        uint256 amount,
        uint8 opType,
        address initiator,
        bytes32 indexed campaignId,
        address indexed campaignAddress
    );

    /**
     * @notice Creates a new EventCollector
     * @param _platformAdmin Address of the platform admin contract
     * @param _owner Address of the contract owner
     */
    constructor(
        address _platformAdmin,
        address _owner
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {}

    /**
     * @notice Authorizes a factory contract to register campaigns
     * @dev Only callable by platform admins
     * @param factoryAddress Address of the factory contract to authorize
     */
    function authorizeFactory(
        address factoryAddress
    ) external onlyPlatformAdmin {
        if (factoryAddress == address(0)) {
            revert CampaignEventCollectorError(
                ERR_ZERO_ADDRESS,
                factoryAddress
            );
        }

        authorizedFactories[factoryAddress] = true;
        emit CampaignEventCollectorOperation(
            OP_FACTORY_AUTHORIZED,
            msg.sender,
            factoryAddress
        );
    }

    /**
     * @notice Revokes authorization from a factory contract
     * @dev Only callable by platform admins
     * @param factoryAddress Address of the factory contract to deauthorize
     */
    function deauthorizeFactory(
        address factoryAddress
    ) external onlyPlatformAdmin {
        if (!authorizedFactories[factoryAddress])
            revert CampaignEventCollectorError(
                ERR_FACTORY_DOES_NOT_EXIST,
                factoryAddress
            );

        authorizedFactories[factoryAddress] = false;
        emit CampaignEventCollectorOperation(
            OP_FACTORY_DEAUTHORIZED,
            msg.sender,
            factoryAddress
        );
    }

    /**
     * @notice Authorizes a Campaign contract to emit events through this collector
     * @dev Can be called by authorized factories
     * @param campaignAddress Address of the Campaign contract to authorize
     */
    function authorizeCampaignFromFactory(address campaignAddress) external {
        if (!authorizedFactories[msg.sender])
            revert CampaignEventCollectorError(
                ERR_FACTORY_NOT_AUTHORIZED,
                msg.sender
            );

        if (campaignAddress == address(0))
            revert CampaignEventCollectorError(
                ERR_ZERO_ADDRESS,
                campaignAddress
            );

        authorizedCampaigns[campaignAddress] = true;

        emit CampaignEventCollectorOperation(
            OP_CAMPAIGN_AUTHORIZED,
            campaignAddress,
            msg.sender
        );
    }

    /**
     * @notice Revokes authorization from a Campaign contract
     * @dev Only callable by platform admins
     * @param campaignAddress Address of the Campaign contract to deauthorize
     */
    function deauthorizeCampaign(
        address campaignAddress
    ) external onlyPlatformAdmin {
        if (!authorizedCampaigns[campaignAddress]) {
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_DOES_NOT_EXIST,
                campaignAddress
            );
        }

        if (campaignAddress == address(0)) {
            revert CampaignEventCollectorError(
                ERR_ZERO_ADDRESS,
                campaignAddress
            );
        }

        authorizedCampaigns[campaignAddress] = false;
        emit CampaignEventCollectorOperation(
            OP_CAMPAIGN_DEAUTHORIZED,
            campaignAddress,
            msg.sender
        );
    }

    /**
     * @notice Emits a Contribution event
     * @dev Only callable by authorized Campaign contracts
     * @param contributor Address of the contributor
     * @param amount Amount contributed
     * @param campaignId Unique identifier of the campaign
     */
    function emitContribution(
        address contributor,
        uint256 amount,
        bytes32 campaignId
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit Contribution(contributor, amount, campaignId, msg.sender);
    }

    /**
     * @notice Emits a RefundIssued event
     * @dev Only callable by authorized Campaign contracts
     * @param contributor Address of the contributor receiving the refund
     * @param amount Amount refunded
     * @param campaignId Unique identifier of the campaign
     */
    function emitRefundIssued(
        address contributor,
        uint256 amount,
        bytes32 campaignId
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit RefundIssued(contributor, amount, campaignId, msg.sender);
    }

    /**
     * @notice Emits a FundsClaimed event
     * @dev Only callable by authorized Campaign contracts
     * @param initiator Address that initiated the claim
     * @param amount Amount claimed
     * @param campaignId Unique identifier of the campaign
     */
    function emitFundsClaimed(
        address initiator,
        uint256 amount,
        bytes32 campaignId
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit FundsClaimed(initiator, amount, campaignId, msg.sender);
    }

    /**
     * @notice Emits a CampaignStatusChanged event
     * @dev Only callable by authorized Campaign contracts
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
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit CampaignStatusChanged(
            oldStatus,
            newStatus,
            reason,
            campaignId,
            msg.sender
        );
    }

    /**
     * @notice Emits an AdminOverrideSet event
     * @dev Only callable by authorized Campaign contracts
     * @param status New override status
     * @param admin Admin who made the change
     * @param campaignId Unique identifier of the campaign
     */
    function emitAdminOverrideSet(
        bool status,
        address admin,
        bytes32 campaignId
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit AdminOverrideSet(status, admin, campaignId, msg.sender);
    }

    /**
     * @notice Emits a FundsOperation event
     * @dev Only callable by authorized Campaign contracts
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
    ) external {
        if (!authorizedCampaigns[msg.sender])
            revert CampaignEventCollectorError(
                ERR_CAMPAIGN_NOT_AUTHORIZED,
                msg.sender
            );
        emit FundsOperation(
            token,
            amount,
            opType,
            initiator,
            campaignId,
            msg.sender
        );
    }
}
