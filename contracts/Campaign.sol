// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";

contract Campaign is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public campaignToken;
    bool public isClaimed;
    uint256 public campaignGoalAmount;
    uint256 public campaignDuration;     
    uint256 public campaignStartTime;    
    uint256 public campaignEndTime;      
    uint256 public totalAmountRaised;
    bytes32 public campaignId;
    
    IDefiIntegrationManager public immutable defiManager;
    
    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasBeenRefunded;

    event Contribution(address indexed contributor, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed owner, uint256 amount);
    event FundsDeposited(address indexed token, uint256 amount);
    event YieldHarvested(address indexed token, uint256 creatorYield);
    event WithdrawnFromYield(address indexed token, uint256 amount);
    event TokensSwapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);

    error InvalidAddress();
    error ContributionTokenNotSupported(address token);
    error InvalidGoalAmount(uint256 amount);
    error InvalidCampaignDuration(uint256 duration);
    error InvalidContributionAmount(uint256 amount);
    error CampaignNotActive();
    error CampaignStillActive();
    error CampaignGoalReached();
    error CampaignGoalNotReached();
    error ETHNotAccepted();
    error AlreadyRefunded();
    error NothingToRefund(address user);
    error RefundFailed();
    error FundsAlreadyClaimed();
    error ClaimTransferFailed();
    error InvalidSwapAmount(uint256);

    constructor(
        address _owner,
        address _campaignToken,
        uint256 _campaignGoalAmount,
        uint256 _campaignDuration,
        address _defiManager
    ) Ownable(_owner) {
        if (_campaignToken == address(0)) revert InvalidAddress();
        if (_defiManager == address(0)) revert InvalidAddress();
        
        defiManager = IDefiIntegrationManager(_defiManager);
        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();
        
        if(!tokenRegistry.isTokenSupported(_campaignToken)) {
            revert ContributionTokenNotSupported(_campaignToken);
        }
        
        if (_campaignGoalAmount == 0) revert InvalidGoalAmount(_campaignGoalAmount);
        if (_campaignDuration == 0) revert InvalidCampaignDuration(_campaignDuration);
        
        campaignToken = _campaignToken;
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = uint64(_campaignDuration);  // Explicit casting
        
        campaignStartTime = uint64(block.timestamp);  // Explicit casting
        campaignEndTime = uint64(campaignStartTime + (_campaignDuration * 1 days));  // Explicit casting
        
        campaignId = keccak256(
            abi.encodePacked(
                _owner,
                _campaignToken,
                _campaignGoalAmount,
                _campaignDuration,
                campaignStartTime,
                block.number
            )
        );
    }
    
    receive() external payable {
        revert ETHNotAccepted();
    }
    
    function contribute(address fromToken, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidContributionAmount(amount);
        if (!isCampaignActive()) revert CampaignNotActive();
        if (totalAmountRaised >= campaignGoalAmount) revert CampaignGoalReached();

        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();
        if(!tokenRegistry.isTokenSupported(fromToken)) {
            revert ContributionTokenNotSupported(fromToken);
        }
        
        uint256 contributionAmount;
        
        if (fromToken == campaignToken) {
            IERC20(campaignToken).safeTransferFrom(msg.sender, address(this), amount);
            contributionAmount = amount;
        } else {
            IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(fromToken).safeIncreaseAllowance(address(defiManager), amount);
            
            uint256 received = defiManager.swapTokenForTarget(fromToken, amount, campaignToken);
            contributionAmount = received;
            emit TokensSwapped(fromToken, campaignToken, amount, received);
           
        }
        
        contributions[msg.sender] += contributionAmount;
        totalAmountRaised += contributionAmount;
        
        emit Contribution(msg.sender, contributionAmount);
    }
    

    function requestRefund() external nonReentrant {

        if (isCampaignActive()) revert CampaignStillActive();
        if (totalAmountRaised >= campaignGoalAmount) revert CampaignGoalReached();
        
        if (hasBeenRefunded[msg.sender]) revert AlreadyRefunded();
        
        uint256 refundAmount = contributions[msg.sender];
        if (refundAmount == 0) revert NothingToRefund(msg.sender);
        
        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;
        
        IERC20(campaignToken).safeTransfer(msg.sender, refundAmount);
        
        emit RefundIssued(msg.sender, refundAmount);
    }
    

    function claimFunds() external onlyOwner nonReentrant {
        if (isCampaignActive()) revert CampaignStillActive();
        if (totalAmountRaised < campaignGoalAmount) revert CampaignGoalNotReached();
        if (isClaimed) revert FundsAlreadyClaimed();
        
        uint256 balance = IERC20(campaignToken).balanceOf(address(this));
        isClaimed = true;
        
        IERC20(campaignToken).safeTransfer(owner(), balance);
        
        emit FundsClaimed(owner(), balance);
    }
    
    function depositToYieldProtocol(address token, uint256 amount) external onlyOwner nonReentrant {
        IERC20(token).safeIncreaseAllowance(address(defiManager), amount);
        
        defiManager.depositToYieldProtocol(token, amount);
        emit FundsDeposited(token, amount);
        
    }

    function harvestYield(address token) external onlyOwner nonReentrant {
        (uint256 _creatorYield, ) = defiManager.harvestYield(token);
        emit YieldHarvested(token, _creatorYield);
    }
    
    function withdrawAllFromYieldProtocol(address token) external onlyOwner nonReentrant {
        uint256 withdrawn = defiManager.withdrawAllFromYieldProtocol(token);
        emit WithdrawnFromYield(token, withdrawn);
    }

    function withdrawFromYieldProtocol(address token, uint256 amount) external onlyOwner nonReentrant {
        uint256 withdrawn =  defiManager.withdrawFromYieldProtocol(token, amount);
        emit WithdrawnFromYield(token, withdrawn);
    }
    
    function isCampaignActive() public view returns (bool) {
        return (
            block.timestamp >= campaignStartTime && 
            block.timestamp < campaignEndTime
        );
    }
    
    function isCampaignSuccessful() public view returns (bool) {
        return totalAmountRaised >= campaignGoalAmount;
    }
    
    function getDepositedAmount(address token) external view returns (uint256) {
        return defiManager.getDepositedAmount(address(this), token);
    }

    function getCurrentYieldRate(address token) external view returns (uint256) {
        return defiManager.getCurrentYieldRate(token);
    }
}