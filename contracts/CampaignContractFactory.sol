//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Campaign.sol";
import "./interfaces/IDefiIntegrationManager.sol";
import "./interfaces/IPlatformAdmin.sol";
import "./libraries/FactoryLibrary.sol";
import "./abstracts/PausableControl.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

/**
 * @title CampaignContractFactory
 * @author Generated with assistance from an LLM
 * @notice Factory contract for deploying new campaign contracts
 * @dev Handles creation and validation of new crowdfunding campaigns
 */
contract CampaignContractFactory is
    Ownable,
    PlatformAdminAccessControl,
    PausableControl
{
    // Use the library
    using FactoryLibrary for *;

    // Operation and error codes for more compact representation
    /**
     * @dev Constant defining campaign creation operation type for events
     */
    uint8 private constant OP_CAMPAIGN_CREATED = 1;

    /**
     * @dev Error code for campaign constructor validation failure
     */
    uint8 private constant ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 1;

    /**
     * @dev Error code for invalid address
     */
    uint8 private constant ERR_INVALID_ADDRESS = 2;

    /**
     * @notice Reference to the DeFi integration manager
     * @dev Immutable reference to the DeFi integration manager contract used by campaigns
     */
    IDefiIntegrationManager public immutable defiManager;

    /**
     * @notice Emitted when a factory operation is performed
     * @param opType Type of operation (1 = campaign created)
     * @param campaignAddress Address of the created campaign contract
     * @param creator Address of the campaign creator
     * @param campaignId Unique identifier of the created campaign
     */
    event FactoryOperation(
        uint8 opType,
        address indexed campaignAddress,
        address indexed creator,
        bytes32 campaignId
    );

    /**
     * @notice Thrown when a factory operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     * @param value Related value (if applicable)
     */
    error FactoryError(uint8 code, address addr, uint256 value);

    /**
     * @notice Creates a new CampaignContractFactory
     * @dev Sets up the factory with specified parameters and validates inputs
     * @param _defiManager Address of the DeFi integration manager
     * @param _platformAdmin Address of the platform admin contract
     * @param _owner Address of the factory owner
     */
    constructor(
        address _defiManager,
        address _platformAdmin,
        address _owner
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_defiManager == address(0) || _platformAdmin == address(0)) {
            revert FactoryError(ERR_INVALID_ADDRESS, address(0), 0);
        }
        defiManager = IDefiIntegrationManager(_defiManager);
        platformAdmin = IPlatformAdmin(_platformAdmin);
    }

    /**
     * @notice Deploys a new campaign contract
     * @dev Validates parameters and creates a new Campaign contract instance
     * @param _campaignToken Address of the token to be used for the campaign
     * @param _campaignGoalAmount Target funding goal amount
     * @param _campaignDuration Duration of the campaign in days
     * @return Address of the newly created campaign contract
     */
    function deploy(
        address _campaignToken,
        uint256 _campaignGoalAmount,
        uint32 _campaignDuration
    ) external whenNotPaused returns (address) {
        // Use the library to validate parameters
        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();

        // We need to create a local function reference to pass to the library
        function(address)
            external
            view
            returns (bool) isTokenSupported = tokenRegistry.isTokenSupported;

        bool isValid = FactoryLibrary.validateCampaignParams(
            _campaignToken,
            _campaignGoalAmount,
            _campaignDuration,
            isTokenSupported
        );

        if (!isValid) {
            revert FactoryError(
                ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
                address(0),
                0
            );
        }

        // Create new campaign
        Campaign newCampaign = new Campaign(
            msg.sender,
            _campaignToken,
            _campaignGoalAmount,
            _campaignDuration,
            address(defiManager),
            address(platformAdmin)
        );

        // Store campaign information
        address campaignAddress = address(newCampaign);

        // Emit event with operation type
        bytes32 campaignId = newCampaign.campaignId();
        emit FactoryOperation(
            OP_CAMPAIGN_CREATED,
            campaignAddress,
            msg.sender,
            campaignId
        );

        return campaignAddress;
    }
}
