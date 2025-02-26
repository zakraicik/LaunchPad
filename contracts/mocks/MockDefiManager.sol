//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../interfaces/ITokenRegistry.sol";

contract MockDefiManager {
    bool public authorizeSuccess = true;
    mapping(address => bool) public authorizedCampaigns;
    address public mockTokenRegistryAddress;
    
    constructor(address _tokenRegistryAddress) {
        mockTokenRegistryAddress = _tokenRegistryAddress;
    }
    
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
    
    function tokenRegistry() external view returns (ITokenRegistry) {
        return ITokenRegistry(mockTokenRegistryAddress);
    }

    function depositToYieldProtocol(address token, uint256 amount) external returns (bool) {

    }
    
    function withdrawFromYieldProtocol(address token, uint256 amount) external returns (uint256) {
        return amount;
    }
    
    function withdrawAllFromYieldProtocol(address token) external returns (uint256) {
        return 100; // Mock value
    }
    
    function harvestYield(address token) external returns (uint256, uint256) {
        return (50, 10); // Mock creator yield and platform yield
    }
    
    function getCurrentYieldRate(address token) external pure returns (uint256) {
        return 500; // 5% in basis points
    }
    
    function getDepositedAmount(address campaign, address token) external pure returns (uint256) {
        return 1000;
    }
    
    function swapTokenForTarget(address fromToken, uint256 amount, address toToken) external returns (uint256) {
        return amount * 2; // Mock exchange rate
    }
    
}