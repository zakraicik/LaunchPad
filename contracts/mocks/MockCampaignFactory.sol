//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IDefiIntegrationManager.sol";

contract MockCampaignFactory {
    address public defiManager;
    
    mapping(address => bool) public deployedCampaigns;
    
    event CampaignCreated(address indexed campaign);
    
    constructor(address _defiManager) {
        defiManager = _defiManager;
    }
    
    function createCampaign(
        address owner,
        address token,
        uint256 goal,
        uint256 duration
    ) external returns (address) {
        // For testing purposes, we just use the msg.sender as the campaign address
        address campaignAddress = msg.sender;
        
        // Register the campaign with the DefiIntegrationManager
        IDefiIntegrationManager manager = IDefiIntegrationManager(defiManager);
        manager.authorizeCampaign(campaignAddress);
        
        deployedCampaigns[campaignAddress] = true;
        
        emit CampaignCreated(campaignAddress);
        
        return campaignAddress;
    }
    
    function registerExistingCampaign(address campaignAddress) external {
        require(!deployedCampaigns[campaignAddress], "Campaign already registered");
        
        // Register the campaign with the DefiIntegrationManager
        IDefiIntegrationManager manager = IDefiIntegrationManager(defiManager);
        manager.authorizeCampaign(campaignAddress);
        
        deployedCampaigns[campaignAddress] = true;
        
        emit CampaignCreated(campaignAddress);
    }
    
    function setCampaignState(address campaignAddress, bool isDeployed) external {
        deployedCampaigns[campaignAddress] = isDeployed;
    }
}