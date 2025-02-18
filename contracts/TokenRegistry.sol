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
    mapping(address => bool) private tokenExists;
    address[] public supportedTokens;
    address public wETHAddress;

    error InvalidToken(address _token);
    error TokenAlreadyInRegistry(address _token);
    error TokenNotInRegistry(address _token);
    error TokenSupportAlreadyEnabled(address _token);
    error TokenSupportAlreadyDisabled(address _token);

    event TokenAdded(address indexed token, uint256 minimumContributionAmount);
    event TokenRemovedFromRegistry(address indexed token);
    event TokenSupportDisabled(address indexed token);
    event TokenSupportEnabled(address indexed token);
    event TokenConfigUpdated(address indexed token, uint256 minimumContributionAmount);
    event TokenMinimumContributionUpdated(address indexed token);
    event WETHAddressUpdated(address wETHUpdatd);

    function _tokenExists(address token) internal view returns (bool) {
        return tokenExists[token];
    }

    function _tokenSupported(address token) internal view returns (bool) {
        return tokenConfigs[token].isSupported;
    }

    function addToken(address _token, uint256 _minimumContributionAmount) external onlyOwner{
        if(_token == address(0)){
            revert InvalidToken(_token);
        }

        if(_tokenExists(_token)){
            revert TokenAlreadyInRegistry(_token);
        }

        tokenConfigs[_token] = TokenConfig({
            isSupported: true,
            minimumContributionAmount:_minimumContributionAmount
        });

        tokenExists[_token] = true;

        supportedTokens.push(_token);

        emit TokenAdded(_token, _minimumContributionAmount);

    }

    function removeToken(address _token) external onlyOwner {
        if(!_tokenExists(_token)){
            revert TokenNotInRegistry(_token);
        }

        delete tokenConfigs[_token];
        delete tokenExists[_token];

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        emit TokenRemovedFromRegistry(_token);
    }

    function disableTokenSupport(address _token) external onlyOwner{
        if(!_tokenExists(_token)){
            revert TokenNotInRegistry(_token);
        }

        if (!_tokenSupported(_token)){
            revert TokenSupportAlreadyDisabled(_token);
        }

        tokenConfigs[_token].isSupported = false;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        emit TokenSupportDisabled(_token);

    }

    function enableTokenSupport(address _token) external onlyOwner{
        if(!_tokenExists(_token)){
            revert TokenNotInRegistry(_token);
        }

        if (_tokenSupported(_token)){
            revert TokenSupportAlreadyEnabled(_token);
        }

        tokenConfigs[_token].isSupported = true;

        supportedTokens.push(_token);

        emit TokenSupportEnabled(_token); 

    }

    function updateTokenMinimumContribution(address _token, uint256 _minimumContributionAmount) external onlyOwner{
        if(!_tokenExists(_token)){
            revert TokenNotInRegistry(_token);
        }

        tokenConfigs[_token].minimumContributionAmount = _minimumContributionAmount;

        emit TokenMinimumContributionUpdated(_token);
    }

    function setWETHAddress(address _wethAddress) external onlyOwner {
        wETHAddress = _wethAddress;

        emit WETHAddressUpdated(_wethAddress);
    }

    function getMinContributionAmount(address token) external view returns (uint256) {
        return tokenConfigs[token].minimumContributionAmount;
    }

    function getAllSupportedTokens() external view returns(address[] memory){
        return supportedTokens;
    }

    function getWETH() external view returns (address) {
        return wETHAddress;
    }



}
