//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Campaign is Ownable, ReentrancyGuard {

    constructor(
        address _owner,
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration,
        string memory _campaignName,
        string memory _campaignDescription
    ) Ownable(_owner) {
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = _campaignDuration;
        campaignName = _campaignName;
        campaignDescription = _campaignDescription;
        campaignStartTime = block.timestamp;
        campaignEndTime = block.timestamp + (campaignDuration * 1 days);
    }

    //State Variables 
    uint16 public campaignDuration;         
    bool public isClaimed;                  
    uint256 public campaignGoalAmount;      
    uint256 public campaignStartTime;       
    uint256 public campaignEndTime;         
    uint256 public totalAmountRaised;   
    string public campaignName;             
    string public campaignDescription;      
    mapping(address => uint256) public contributions;
    mapping(address => bool) private hasBeenRefunded;

    //Errors 
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

    //Events
    event contribution(address _sender, uint256 _amount);
    event fundsClaimed(address _owner, uint256 _amount);
    event refundIssued(address _sender, uint256 amount);
    event CampaignExtended(uint256 _sender, uint256 amount);
    event CampaignPauseStatusChanged(bool _status);

    //Helper Functions
    function _isCampaignActive() internal view returns(bool){
        return block.timestamp >= campaignStartTime && block.timestamp <= campaignEndTime;
    }

    function _isCampaignGoalReached() internal view returns(bool){
        return totalAmountRaised >= campaignGoalAmount;
    }
    
    //State Changing Functions
    function contribute() payable external nonReentrant returns(bool) {
        if (!_isCampaignActive()){
            revert CampaignNotActive();
        }

        if (_isCampaignGoalReached()){
            revert CampaignGoalReached();
        }

        if (msg.value <=0){
            revert InvalidContributionAmount(msg.value);
        }

        contributions[msg.sender] += msg.value;
        totalAmountRaised+= msg.value;

        emit contribution(msg.sender,msg.value);

        return true;

    }

    function claimFunds() external onlyOwner nonReentrant returns(bool){
        if (_isCampaignActive()){
            revert CampaignStillActive();
        }

        if (!_isCampaignGoalReached()){
            revert CampaignGoalNotReached();
        }

        if (isClaimed){
            revert FundsAlreadyClaimed();
        }

        isClaimed = true;

        uint256 contractBalance = address(this).balance;

        (bool success, ) = payable(owner()).call{value:contractBalance}("");
        if(!success){
            revert ClaimTransferFailed();
        }

        emit fundsClaimed(owner(), contractBalance);

        return true;
    }

    function requestRefund() external nonReentrant returns(bool){
        if (_isCampaignActive()){
            revert CampaignStillActive();
        }

        if (_isCampaignGoalReached()){
            revert CampaignGoalReached();
        }

        if (hasBeenRefunded[msg.sender]) {
            revert AlreadyRefunded();
        }

        uint256 contributionAmount = contributions[msg.sender];
        if (contributionAmount <= 0){
            revert NothingToRefund(msg.sender);
        }

        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value:contributionAmount}("");
        if(!success){
            revert RefundFailed();
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

}