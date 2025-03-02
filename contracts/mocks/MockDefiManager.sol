//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITokenRegistry.sol";
import "../interfaces/IYieldDistributor.sol";

contract MockDefiManager {
    // State tracking
    bool public authorizeSuccess = true;
    bool public depositSuccess = true;
    bool public withdrawSuccess = true;
    bool public harvestSuccess = true;
    bool public swapSuccess = true;
    
    mapping(address => bool) public authorizedCampaigns;
    mapping(address => mapping(address => uint256)) public aaveDeposits; // Campaign -> token -> amount
    
    // Interface contracts
    address public mockTokenRegistryAddress;
    address public mockYieldDistributorAddress;
    
    // Mock yield parameters
    uint256 public yieldRate = 1000; // 10% annually in basis points
    uint256 public constant UNISWAP_FEE_TIER = 3000; // 0.3%
    
    // Events (matching real implementation)
    event YieldDeposited(address indexed campaign, address indexed token, uint256 amount);
    event YieldWithdrawn(address indexed campaign, address indexed token, uint256 amount);
    event YieldHarvested(
        address indexed campaign,
        address indexed token,
        uint256 totalYield,
        uint256 creatorShare,
        uint256 platformShare
    );
    event TokenSwapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event CampaignAuthorized(address indexed campaign);
    
    constructor(address _tokenRegistryAddress, address _yieldDistributorAddress) {
        mockTokenRegistryAddress = _tokenRegistryAddress;
        mockYieldDistributorAddress = _yieldDistributorAddress;
    }
    
    // Control functions for testing
    function setAuthorizeSuccess(bool success) external {
        authorizeSuccess = success;
    }
    
    function setDepositSuccess(bool success) external {
        depositSuccess = success;
    }
    
    function setWithdrawSuccess(bool success) external {
        withdrawSuccess = success;
    }
    
    function setHarvestSuccess(bool success) external {
        harvestSuccess = success;
    }
    
    function setSwapSuccess(bool success) external {
        swapSuccess = success;
    }
    
    function setYieldRate(uint256 _yieldRate) external {
        yieldRate = _yieldRate;
    }
    
    function simulateDeposit(address campaign, address token, uint256 amount) external {
        aaveDeposits[campaign][token] += amount;
    }
    
    // Interface implementation
    function authorizeCampaign(address campaign) external returns (bool) {
        if (authorizeSuccess) {
            authorizedCampaigns[campaign] = true;
            emit CampaignAuthorized(campaign);
            return true;
        }
        return false;
    }
    
    function tokenRegistry() external view returns (ITokenRegistry) {
        return ITokenRegistry(mockTokenRegistryAddress);
    }

    function depositToYieldProtocol(address token, uint256 amount) external returns (bool) {
        if (!depositSuccess) {
            revert("Deposit failed");
        }
        
        // Validate token via registry
        ITokenRegistry registry = ITokenRegistry(mockTokenRegistryAddress);
        require(registry.isTokenSupported(token), "Token not supported");
        
        // Transfer tokens from sender
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");
        
        // Update deposits for the calling campaign
        aaveDeposits[msg.sender][token] += amount;
        
        emit YieldDeposited(msg.sender, token, amount);
        return true;
    }
    
    function withdrawFromYieldProtocol(address token, uint256 amount) external returns (uint256) {
        if (!withdrawSuccess) {
            revert("Withdrawal failed");
        }
        
        uint256 availableAmount = aaveDeposits[msg.sender][token];
        if (amount > availableAmount) {
            revert("Insufficient deposit");
        }
        
        uint256 withdrawAmount = amount;
        
        if (withdrawAmount > 0) {
            aaveDeposits[msg.sender][token] -= withdrawAmount;
            bool success = IERC20(token).transfer(msg.sender, withdrawAmount);
            require(success, "Token transfer failed");
            
            emit YieldWithdrawn(msg.sender, token, withdrawAmount);
        }
        
        return withdrawAmount;
    }
    
    function withdrawAllFromYieldProtocol(address token) external returns (uint256) {
        if (!withdrawSuccess) {
            revert("Withdrawal failed");
        }
        
        uint256 withdrawAmount = aaveDeposits[msg.sender][token];
        
        if (withdrawAmount == 0) {
            revert("Zero amount");
        }
        
        aaveDeposits[msg.sender][token] = 0;
        bool success = IERC20(token).transfer(msg.sender, withdrawAmount);
        require(success, "Token transfer failed");
            
        emit YieldWithdrawn(msg.sender, token, withdrawAmount);
        
        return withdrawAmount;
    }
    
    function harvestYield(address token) external returns (uint256, uint256) {
        if (!harvestSuccess) {
            revert("Harvest failed");
        }
        
        uint256 depositAmount = aaveDeposits[msg.sender][token];
        if (depositAmount == 0) {
            revert("No yield");
        }
        
        // Calculate yield based on deposit amount and yield rate
        uint256 totalYield = (depositAmount * yieldRate) / 10000;
        
        if (totalYield == 0) {
            revert("No yield");
        }
        
        // Use the actual YieldDistributor logic to calculate shares
        IYieldDistributor distributor = IYieldDistributor(mockYieldDistributorAddress);
        (uint256 creatorYield, uint256 platformYield) = distributor.calculateYieldShares(totalYield);
        
        // Transfer to campaign
        bool success = IERC20(token).transfer(msg.sender, creatorYield);
        require(success, "Token transfer failed");
        
        // Transfer to platform treasury
        address treasury = distributor.getPlatformTreasury();
        success = IERC20(token).transfer(treasury, platformYield);
        require(success, "Token transfer to treasury failed");
        
        emit YieldHarvested(msg.sender, token, totalYield, creatorYield, platformYield);
        
        return (creatorYield, platformYield);
    }
    
    function getCurrentYieldRate(address token) external view returns (uint256) {
        return yieldRate;
    }
    
    function getDepositedAmount(address campaign, address token) external view returns (uint256) {
        return aaveDeposits[campaign][token];
    }
    
    function isCampaignAuthorized(address campaign) external view returns (bool) {
        return authorizedCampaigns[campaign];
    }
    
    function swapTokenForTarget(address fromToken, uint256 amount, address toToken) external returns (uint256) {
        if (!swapSuccess) {
            revert("Swap failed");
        }
        
        // Token validation
        ITokenRegistry registry = ITokenRegistry(mockTokenRegistryAddress);
        require(registry.isTokenSupported(fromToken), "Source token not supported");
        require(registry.isTokenSupported(toToken), "Target token not supported");
        
        if (fromToken == toToken) {
            revert("Tokens are the same");
        }
        
        // Transfer tokens from caller
        bool success = IERC20(fromToken).transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");
        
        uint256 receivedAmount = amount * 2; // 2:1 exchange rate for testing
        
        success = IERC20(toToken).transfer(msg.sender, receivedAmount);
        require(success, "Token transfer failed");
        
        emit TokenSwapped(fromToken, toToken, amount, receivedAmount);
        
        return receivedAmount;
    }
    
    // Mock auxiliary functions to simulate realistic behavior
    function unauthorizeCampaign(address campaign) external {
        authorizedCampaigns[campaign] = false;
    }
    
    function getTokenRegistry() external view returns (ITokenRegistry) {
        return ITokenRegistry(mockTokenRegistryAddress);
    }
}