//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Campaign.sol";
import "./interfaces/IDefiIntegrationManager.sol";
import "./interfaces/IPlatformAdmin.sol";
import "./libraries/FactoryLibrary.sol";
import "./abstracts/PausableControl.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

contract CampaignContractFactory is
    Ownable,
    PlatformAdminAccessControl,
    PausableControl
{
    // Use the library
    using FactoryLibrary for *;

    // Operation and error codes for more compact representation
    uint8 private constant OP_CAMPAIGN_CREATED = 1;
    uint8 private constant ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 1;
    uint8 private constant ERR_INVALID_ADDRESS = 2;

    // State variables
    address[] public deployedCampaigns;
    mapping(address => address[]) public creatorToCampaigns;
    IDefiIntegrationManager public immutable defiManager;

    // Consolidated events with operation type parameter
    event FactoryOperation(
        uint8 opType,
        address indexed campaignAddress,
        address indexed creator,
        bytes32 campaignId
    );

    // Consolidated error with error code
    error FactoryError(uint8 code, address addr, uint256 value);

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
        deployedCampaigns.push(campaignAddress);
        creatorToCampaigns[msg.sender].push(campaignAddress);

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

    // View functions - these are small and don't need optimization
    function getAllCampaigns() external view returns (address[] memory) {
        return deployedCampaigns;
    }

    function getCampaignsByCreator(
        address _creator
    ) external view returns (address[] memory) {
        if (_creator == address(0)) {
            revert FactoryError(ERR_INVALID_ADDRESS, _creator, 0);
        }

        return creatorToCampaigns[_creator];
    }

    function getCampaignsCount() external view returns (uint256) {
        return deployedCampaigns.length;
    }

    function getCreatorCampaignsCount(
        address _creator
    ) external view returns (uint256) {
        if (_creator == address(0)) {
            revert FactoryError(ERR_INVALID_ADDRESS, _creator, 0);
        }

        return creatorToCampaigns[_creator].length;
    }
}
