//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "../interfaces/IAavePool.sol";

contract MockAavePool is IAavePool {
    // Configuration
    bool public shouldFailSupply = false;
    bool public shouldFailWithdraw = false;
    bool public shouldFailGetReserveData = false;
    mapping(address => address) public aTokens;
    mapping(address => uint128) public liquidityRates; // in ray (1e27)

    // Mock aToken contract we deploy separately 
    address public mockATokenImplementation;
    
    // Events
    event Supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode);
    event Withdraw(address asset, uint256 amount, address to);
    
    constructor(address _mockATokenImplementation) {
        mockATokenImplementation = _mockATokenImplementation;
    }
    
    // Configuration functions
    function setAToken(address asset, address aToken) external {
        aTokens[asset] = aToken;
    }
    
    function setLiquidityRate(address asset, uint128 rate) external {
        liquidityRates[asset] = rate;
    }
    
    function setShouldFailSupply(bool shouldFail) external {
        shouldFailSupply = shouldFail;
    }
    
    function setShouldFailWithdraw(bool shouldFail) external {
        shouldFailWithdraw = shouldFail;
    }
    
    function setShouldFailGetReserveData(bool shouldFail) external {
        shouldFailGetReserveData = shouldFail;
    }
    
    // IAavePool implementation
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external override {
        if (shouldFailSupply) {
            revert("Supply failed");
        }
        
        address aToken = aTokens[asset];
        if (aToken == address(0)) {
            revert("No aToken for asset");
        }
        
        // Take tokens from caller
        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        // Mint aTokens to onBehalfOf
        (bool callSuccess, ) = aToken.call(
            abi.encodeWithSignature("mint(address,uint256)", onBehalfOf, amount)
        );
        require(callSuccess, "aToken mint failed");
        
        emit Supply(asset, amount, onBehalfOf, referralCode);
    }
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override returns (uint256) {
        if (shouldFailWithdraw) {
            revert("Withdraw failed");
        }
        
        address aToken = aTokens[asset];
        if (aToken == address(0)) {
            revert("No aToken for asset");
        }
        
        // Burn aTokens
        (bool callSuccess, ) = aToken.call(
            abi.encodeWithSignature("burn(address,uint256)", msg.sender, amount)
        );
        require(callSuccess, "aToken burn failed");
        
        // Transfer underlying to recipient
        bool success = IERC20(asset).transfer(to, amount);
        require(success, "Transfer failed");
        
        emit Withdraw(asset, amount, to);
        return amount;
    }
    
    function getReserveData(address asset) external view override returns (DataTypes.ReserveData memory) {
        if (shouldFailGetReserveData) {
            revert("GetReserveData failed");
        }
        
        DataTypes.ReserveData memory data;
        data.aTokenAddress = aTokens[asset];
        data.currentLiquidityRate = liquidityRates[asset]; // in ray (1e27)
        
        return data;
    }
}