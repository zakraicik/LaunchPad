//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenRegistry is Ownable {

    constructor(address _owner) Ownable(_owner){

    }

    struct TokenConfig {
        bool isSupported;
        uint256 minimumContributionAmount;
    }

    mapping(address => TokenConfig) public tokenConfigs;
    address[] public supportedTokens;
    address public wETHAddress;

    error TokenAlreadySupporeted(address _token, uint256 _minimumContributionAmount);

    event TokenAdded(address indexed token, uint256 minimumContributionAmount);
    event TokenRemoved(address indexed token);
    event TokenConfigUpdated(address indexed token, uint256 minimumContributionAmount);
    event WETHAddressUpdated(address oldWETH, address newWETH);

    function _isTokenSupported(address token) external view returns (bool) {
        return tokenConfigs[token].isSupported;
    }

    function addToken(address _token, uint256 _minimumContributionAmount) external onlyOwner{

    }

    function removeToken(address _token) external onlyOwner {

    }

    function updateTokenConfig(address _token, uint256 _minimumContributionAmount) external onlyOwner{

    }

    function setWETHAddress(address _wethAddress) external onlyOwner {
    }

    function getMinContributionAmount(address token) external view returns (uint256) {
        return tokenConfigs[token].minimumContributionAmount;
    }

    function getAllSupportedTokens() external view returns(address[] memory){

    }

    function getWETH() external view returns (address) {
        return wETHAddress;
    }



}
