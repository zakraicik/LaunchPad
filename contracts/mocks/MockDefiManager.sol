//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockDefiManager {
    bool public authorizeSuccess = true;
    mapping(address => bool) public authorizedCampaigns;
    
    function setAuthorizeSuccess(bool success) external {
        authorizeSuccess = success;
    }
    
    function authorizeCampaign(address campaign) external returns (bool) {
        if (authorizeSuccess) {
            authorizedCampaigns[campaign] = true;
            return true;
        }
        return false;
    }
    
    function tokenRegistry() external pure returns (address) {
        return address(2); // Mock registry address
    }
}