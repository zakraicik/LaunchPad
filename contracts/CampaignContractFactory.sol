//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "./Campaign.sol";
import "./interfaces/IDefiIntegrationManager.sol";


contract CampaignFactory {
    address[] public deployedCampaigns;
    mapping(address => address[]) public creatorToCampaigns;
    IDefiIntegrationManager public defiManager;
    
    event CampaignCreated(address indexed campaignAddress, address indexed creator, bytes32 campaignId);
    
    error InvalidAddress();
    error ContributionTokenNotSupported();

    constructor(address _defiManager) {
        if(_defiManager == address(0)) {
            revert InvalidAddress();
        }
        defiManager = IDefiIntegrationManager(_defiManager);
    }
    
    function deploy(
        address _campaignToken,
        address _tokenRegistry,
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration
    ) external returns(address) {

        if(_tokenRegistry == address(0)){
            revert InvalidAddress();
        }

        if (_campaignToken != address(0)) {
            ITokenRegistry tokenRegistry = ITokenRegistry(_tokenRegistry);
            if(!tokenRegistry.isTokenSupported(_campaignToken)){
                revert ContributionTokenNotSupported();
            }
            
        }

        Campaign newCampaign = new Campaign(
            msg.sender, 
            _campaignToken,
            _tokenRegistry,
            _campaignGoalAmount, 
            _campaignDuration,
            address(defiManager)
        );
        
        address campaignAddress = address(newCampaign);
        deployedCampaigns.push(campaignAddress);
        creatorToCampaigns[msg.sender].push(campaignAddress);
        
        defiManager.authorizeCampaign(campaignAddress);
        
        bytes32 campaignId = newCampaign.campaignId();
        
        emit CampaignCreated(campaignAddress, msg.sender, campaignId);
        
        return campaignAddress;
    }
        

    function getAllCampaigns() external view returns(address[] memory) {
        return deployedCampaigns;
    }
    
    function getCampaignsByCreator(address _creator) external view returns(address[] memory) {
        return creatorToCampaigns[_creator];
    }
    
    function getCampaignsCount() external view returns(uint256) {
        return deployedCampaigns.length;
    }
    
    function getCreatorCampaignsCount(address _creator) external view returns(uint256) {
        return creatorToCampaigns[_creator].length;
    }
}