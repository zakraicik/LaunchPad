//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";

contract Campaign is Ownable, ReentrancyGuard {

    uint16 public campaignDuration;         
    bool public isClaimed;                  
    uint256 public campaignGoalAmount;      
    uint256 public campaignStartTime;       
    uint256 public campaignEndTime;         
    uint256 public totalAmountRaised;   
    string public campaignName;             
    string public campaignDescription;   
    address public campaignToken;  
    address public tokenRegistry; 
    mapping(address => uint256) public contributions;
    mapping(address => bool) private hasBeenRefunded;
    IDefiIntegrationManager public defiManager;
    bool public defiEnabled;

    error InvalidAddress();
    error CampaignStillActive();
    error CampaignNotActive();
    error CampaignGoalReached();
    error CampaignGoalNotReached();
    error InvalidContributionAmount(uint256 _amount);
    error FundsAlreadyClaimed();
    error ClaimTransferFailed();
    error NothingToRefund(address _sender);
    error AlreadyRefunded();
    error RefundFailed();
    error DefiNotEnabled();
    error DefiAlreadyEnabled();
    error TokenTransferFailed();
    error DefiActionFailed();

    event contribution(address _sender, uint256 _amount);
    event fundsClaimed(address _owner, uint256 _amount);
    event refundIssued(address _sender, uint256 amount);
    event CampaignExtended(uint256 _sender, uint256 amount);
    event CampaignPauseStatusChanged(bool _status);
    event DefiManagerSet(address defiManager);
    event FundsDeposited(address token, uint256 amount);
    event FundsWithdrawn(address token, uint256 amount);
    event YieldHarvested(address token, uint256 amount);

    constructor(
        address _owner,
        address _campaignToken,
        address _tokenRegistry,
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration,
        string memory _campaignName,
        string memory _campaignDescription,
        address _defiManager
    ) Ownable(_owner) {
        campaignToken = _campaignToken;
        tokenRegistry = _tokenRegistry;
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = _campaignDuration;
        campaignName = _campaignName;
        campaignDescription = _campaignDescription;
        campaignStartTime = block.timestamp;
        campaignEndTime = block.timestamp + (campaignDuration * 1 days);

        if (_defiManager == address(0)) {
            revert InvalidAddress();
        }


        defiManager = IDefiIntegrationManager(_defiManager);
        defiEnabled = true;
        emit DefiManagerSet(_defiManager);
        
    }

    function _isCampaignActive() internal view returns(bool){
        return block.timestamp >= campaignStartTime && block.timestamp <= campaignEndTime;
    }

    function _isCampaignGoalReached() internal view returns(bool){
        return totalAmountRaised >= campaignGoalAmount;
    }

    function contributeETH() external payable nonReentrant returns(bool) {
        if (!_isCampaignActive()){
            revert CampaignNotActive();
        }

        if (_isCampaignGoalReached()){
            revert CampaignGoalReached();
        }

        if (campaignToken != address(0)) {
            revert("Campaign does not accept ETH");
        }

        if (msg.value <= 0){
            revert InvalidContributionAmount(msg.value);
        }

        contributions[msg.sender] += msg.value;
        totalAmountRaised += msg.value;

        emit contribution(msg.sender, msg.value);

        return true;
    }

    function contributeERC20(uint256 amount) external nonReentrant returns(bool) {
        if (!_isCampaignActive()){
            revert CampaignNotActive();
        }

        if (_isCampaignGoalReached()){
            revert CampaignGoalReached();
        }

        if (campaignToken == address(0)) {
            revert("Campaign does not accept tokens");
        }

        if (amount <= 0){
            revert InvalidContributionAmount(amount);
        }

        bool success = IERC20(campaignToken).transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TokenTransferFailed();
        }

        contributions[msg.sender] += amount;
        totalAmountRaised += amount;

        emit contribution(msg.sender, amount);

        return true;
    }
    

    function depositToYieldProtocol(address token, uint256 amount) external onlyOwner nonReentrant {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        IERC20(token).approve(address(defiManager), amount);
        
        try defiManager.depositToYieldProtocol(token, amount) {
            emit FundsDeposited(token, amount);
        } catch {
            revert DefiActionFailed();
        }
    }

    function withdrawFromYieldProtocol(address token, uint256 amount) external onlyOwner nonReentrant {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        try defiManager.withdrawFromYieldProtocol(token, amount) returns (uint256 withdrawn) {
            emit FundsWithdrawn(token, withdrawn);
        } catch {
            revert DefiActionFailed();
        }
    }
    
    function enableDefi(address _defiManager) external onlyOwner {
        if (defiEnabled) {
            revert DefiAlreadyEnabled();
        }
        if (_defiManager == address(0)) {
            revert InvalidAddress();
        }
        defiManager = IDefiIntegrationManager(_defiManager);
        defiEnabled = true;
        emit DefiManagerSet(_defiManager);
    }

    function withdrawAllFromYieldProtocol(address token) external onlyOwner nonReentrant {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        try defiManager.withdrawAllFromYieldProtocol(token) returns (uint256 withdrawn) {
            emit FundsWithdrawn(token, withdrawn);
        } catch {
            revert DefiActionFailed();
        }
    }

    function harvestYield(address token) external onlyOwner nonReentrant returns (uint256 creatorYield) {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        try defiManager.harvestYield(token) returns (uint256 _creatorYield, uint256) {
            emit YieldHarvested(token, _creatorYield);
            return _creatorYield;
        } catch {
            revert DefiActionFailed();
        }
    }

    function swapTokens(address fromToken, uint256 amount, address toToken) external onlyOwner nonReentrant returns (uint256) {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        IERC20(fromToken).approve(address(defiManager), amount);
        
        try defiManager.swapTokenForTarget(fromToken, amount, toToken) returns (uint256 received) {
            return received;
        } catch {
            revert DefiActionFailed();
        }
    }

    function wrapETHAndSwap(address targetToken) external payable onlyOwner nonReentrant returns (uint256) {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        try defiManager.wrapETHAndSwapForTarget{value: msg.value}(targetToken) returns (uint256 received) {
            return received;
        } catch {
            revert DefiActionFailed();
        }
    }

    function getCurrentYieldRate(address token) external view returns (uint256) {
        if (!defiEnabled) {
            return 0;
        }
        return defiManager.getCurrentYieldRate(token);
    }

    function getDepositedAmount(address token) external view returns (uint256) {
        if (!defiEnabled) {
            return 0;
        }
        return defiManager.getDepositedAmount(address(this), token);
    }

    function unwrapWETH(address recipient, uint256 amount) external onlyOwner nonReentrant returns (bool) {
        if (!defiEnabled) {
            revert DefiNotEnabled();
        }
        
        address weth = defiManager.tokenRegistry().getWETH();
        IERC20(weth).approve(address(defiManager), amount);
        
        try defiManager.unwrapWETHAndTransfer(recipient, amount) returns (bool success) {
            return success;
        } catch {
            revert DefiActionFailed();
        }
    }

    function claimFunds() external onlyOwner nonReentrant returns(bool) {
        if (_isCampaignActive()) {
            revert CampaignStillActive();
        }

        if (!_isCampaignGoalReached()) {
            revert CampaignGoalNotReached();
        }

        if (isClaimed) {
            revert FundsAlreadyClaimed();
        }

        isClaimed = true;

        if (campaignToken == address(0)) {
            
            uint256 ethBalance = address(this).balance;
            (bool success, ) = payable(owner()).call{value: ethBalance}("");
            if (!success) {
                revert ClaimTransferFailed();
            }
            emit fundsClaimed(owner(), ethBalance);
        } else {
            uint256 tokenBalance = IERC20(campaignToken).balanceOf(address(this));
            bool success = IERC20(campaignToken).transfer(owner(), tokenBalance);
            if (!success) {
                revert ClaimTransferFailed();
            }
            emit fundsClaimed(owner(), tokenBalance);
        }

        return true;
    }

    function requestRefund() external nonReentrant returns(bool) {
        if (_isCampaignActive()) {
            revert CampaignStillActive();
        }

        if (_isCampaignGoalReached()) {
            revert CampaignGoalReached();
        }

        if (hasBeenRefunded[msg.sender]) {
            revert AlreadyRefunded();
        }

        uint256 contributionAmount = contributions[msg.sender];
        if (contributionAmount <= 0) {
            revert NothingToRefund(msg.sender);
        }

        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        if (campaignToken == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: contributionAmount}("");
            if (!success) {
                revert RefundFailed();
            }
        } else {
            bool success = IERC20(campaignToken).transfer(msg.sender, contributionAmount);
            if (!success) {
                revert RefundFailed();
            }
        }

        emit refundIssued(msg.sender, contributionAmount);

        return true;
    }

    //Read functions 
    function getAddressContribution() external view returns(uint256){
        return contributions[msg.sender];
    }


    function getCampaignDetails() external view returns(
        string memory name,            
        string memory description,     
        uint256 goalAmount,           
        uint16 duration,              
        uint256 timeRemaining,        
        uint256 remainingToGoal,      
        uint256 totalRaised,                         
        bool isActive,                
        bool claimed                  
    ){
        uint256 _timeRemaining = 0;
        if (block.timestamp < campaignEndTime) {
            _timeRemaining = campaignEndTime - block.timestamp;
        }

        uint256 _remainingToGoal = 0;
        if (totalAmountRaised < campaignGoalAmount) {
            _remainingToGoal = campaignGoalAmount - totalAmountRaised;
        }

        return (
            campaignName,
            campaignDescription,
            campaignGoalAmount,
            campaignDuration,
            _timeRemaining,
            _remainingToGoal,
            totalAmountRaised,
            _isCampaignActive(),
            isClaimed
        );
    }

    receive() external payable {}

}