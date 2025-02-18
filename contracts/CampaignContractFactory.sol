//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "./Campaign.sol";

contract CampaignFactory {
    // State variables to track campaigns
    address[] public deployedCampaigns;
    mapping(address => address[]) public creatorToCampaigns;
    
    // Events
    event CampaignCreated(address indexed campaignAddress, address indexed creator);
    
    function deploy(
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration,
        string memory _campaignName,
        string memory _campaignDescription
    ) external returns(address) {
        Campaign newCampaign = new Campaign(
            msg.sender, 
            _campaignGoalAmount, 
            _campaignDuration, 
            _campaignName, 
            _campaignDescription
        );
        
        address campaignAddress = address(newCampaign);
        deployedCampaigns.push(campaignAddress);
        creatorToCampaigns[msg.sender].push(campaignAddress);
        
        emit CampaignCreated(campaignAddress, msg.sender);
        
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