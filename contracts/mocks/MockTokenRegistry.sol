//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


contract MockTokenRegistry {
    mapping(address => bool) public supportedTokens;
    
    function addSupportedToken(address token, bool isSupported) external {
        supportedTokens[token] = isSupported;
    }
    
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
    
    function getMinContributionAmount(address token) external pure returns (uint256 minimumAmount, uint8 decimals) {
        return (100, 18);
    }
    
    function getAllSupportedTokens() external view returns(address[] memory) {
        address[] memory tokens = new address[](1);
        return tokens;
    }
    
    function getWETH() external pure returns (address) {
        return address(1); // Mock WETH address
    }
}