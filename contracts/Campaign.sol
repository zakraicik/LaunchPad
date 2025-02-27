//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";

contract Campaign is Ownable, ReentrancyGuard {

    uint16 public campaignDuration;         
    bool public isClaimed;                  
    bool public defiEnabled;                
    address public campaignToken;          
    IDefiIntegrationManager public defiManager; 
    uint256 public campaignGoalAmount;      
    uint256 public campaignStartTime;       
    uint256 public campaignEndTime;         
    uint256 public totalAmountRaised;       
    bytes32 public campaignId;             
    mapping(address => uint256) public contributions;
    mapping(address => bool) private hasBeenRefunded;


    error InvalidAddress();
    error ContributionTokenNotSupported(address token);
    error InvalidGoalAmount(uint256 amount);
    error InvalidCampaignDuration(uint256 duration);
    error CampaignStillActive();
    error CampaignNotActive();
    error CampaignGoalReached();
    error CampaignGoalNotReached();
    error InvalidContributionAmount(uint256 amount);
    error FundsAlreadyClaimed();
    error ClaimTransferFailed();
    error NothingToRefund(address sender);
    error AlreadyRefunded();
    error RefundFailed();
    error DefiNotEnabled();
    error DefiAlreadyEnabled();
    error TokenTransferFailed();
    error DefiActionFailed();
    error ETHNotAccepted();

    event CampaignCreated(bytes32 campaignId);
    event Contribution(address sender, uint256 amount);
    event FundsClaimed(address owner, uint256 amount);
    event RefundIssued(address sender, uint256 amount);
    event CampaignExtended(uint256 newEndTime, uint256 additionalTime);
    event CampaignPauseStatusChanged(bool status);
    event DefiManagerSet(address defiManager);
    event FundsDeposited(address token, uint256 amount);
    event FundsWithdrawn(address token, uint256 amount);
    event YieldHarvested(address token, uint256 amount);

    constructor(
        address _owner,
        address _campaignToken,
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration,
        address _defiManager
    ) Ownable(_owner) {
        if (_defiManager == address(0)) {
            revert InvalidAddress();
        }

        defiManager = IDefiIntegrationManager(_defiManager);
        defiEnabled = true;
        emit DefiManagerSet(_defiManager);

        if (_campaignToken == address(0)) {
            revert InvalidAddress();
        }
        

        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();
        if(!tokenRegistry.isTokenSupported(_campaignToken)) {
            revert ContributionTokenNotSupported(_campaignToken);
        }
        campaignToken = _campaignToken;


        if(_campaignGoalAmount <= 0) {
            revert InvalidGoalAmount(_campaignGoalAmount);
        }
        campaignGoalAmount = _campaignGoalAmount;

        if(_campaignDuration <= 0) {
            revert InvalidCampaignDuration(_campaignDuration);
        }
        campaignDuration = _campaignDuration;

        campaignStartTime = block.timestamp;
        campaignEndTime = block.timestamp + (campaignDuration * 1 days);
        campaignId = keccak256(abi.encodePacked(_owner, address(this), block.timestamp, block.prevrandao));
        
        emit CampaignCreated(campaignId);
    }


    function _isCampaignActive() internal view returns(bool) {
        return block.timestamp >= campaignStartTime && block.timestamp <= campaignEndTime;
    }

    function _isCampaignGoalReached() internal view returns(bool) {
        return totalAmountRaised >= campaignGoalAmount;
    }


    function contribute(uint256 amount) external nonReentrant returns(bool) {
        if (!_isCampaignActive()) {
            revert CampaignNotActive();
        }

        if (_isCampaignGoalReached()) {
            revert CampaignGoalReached();
        }

        if (amount <= 0) {
            revert InvalidContributionAmount(amount);
        }

        bool success = IERC20(campaignToken).transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TokenTransferFailed();
        }


        contributions[msg.sender] += amount;
        totalAmountRaised += amount;

        emit Contribution(msg.sender, amount);
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
        

        uint256 tokenBalance = IERC20(campaignToken).balanceOf(address(this));
        bool success = IERC20(campaignToken).transfer(owner(), tokenBalance);
        if (!success) {
            revert ClaimTransferFailed();
        }
        
        emit FundsClaimed(owner(), tokenBalance);
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

        bool success = IERC20(campaignToken).transfer(msg.sender, contributionAmount);
        if (!success) {
            revert RefundFailed();
        }

        emit RefundIssued(msg.sender, contributionAmount);
        return true;
    }

    function getAddressContribution() external view returns(uint256) {
        return contributions[msg.sender];
    }

    function getCampaignDetails() external view returns(
        bytes32 id,      
        uint256 goalAmount,           
        uint16 duration,              
        uint256 timeRemaining,        
        uint256 remainingToGoal,      
        uint256 totalRaised,                         
        bool isActive,                
        bool claimed                  
    ) {
        uint256 _timeRemaining = 0;
        if (block.timestamp < campaignEndTime) {
            _timeRemaining = campaignEndTime - block.timestamp;
        }

        uint256 _remainingToGoal = 0;
        if (totalAmountRaised < campaignGoalAmount) {
            _remainingToGoal = campaignGoalAmount - totalAmountRaised;
        }

        return (
            campaignId,  
            campaignGoalAmount,
            campaignDuration,
            _timeRemaining,
            _remainingToGoal,
            totalAmountRaised,
            _isCampaignActive(),
            isClaimed
        );
    }

    receive() external payable {
        revert ETHNotAccepted();
    }
}