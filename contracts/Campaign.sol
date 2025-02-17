//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Campaign is Ownable {
    //State Variables 
    address public campaignTargetToken;     
    bool public isClaimed;
    bool public isEnded;         
    address public campaignContractFactory; 
    uint256 public campaignGoalAmount;       
    uint256 public campaignMinimumDonation;  
    uint256 public campaignStartTime;       
    uint256 public campaignEndTime;         
    uint256 public totalAmountRaised;   
    uint16 public campaignDuration;  
    string public campaignName;             
    string public campaignDescription;      
    mapping(address => uint256) public contributions;
    address[] public contributors;

    //Errors 

    //Events
    
    constructor(
        address _owner,
        uint256 _campaignGoalAmount,
        uint16 _campaignDuration,
        string memory _campaignName,
        string memory _campaignDescription,
        address _campaignTargetToken,
        uint256 _campaignMinimumDonation,
        address _campaignContractFactory
    ) Ownable(_owner) {
        campaignTargetToken = _campaignTargetToken;
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = _campaignDuration;
        campaignName = _campaignName;
        campaignDescription = _campaignDescription;
        campaignMinimumDonation = _campaignMinimumDonation;
        campaignContractFactory = _campaignContractFactory;
        campaignStartTime = block.timestamp;
        campaignEndTime = block.timestamp + (campaignDuration * 1 days);
    }

    //Helper Functions
    function _isCampaignActive() internal returns(bool){

    }

    function _isCampaignGoalReached() internal returns(bool){

    }

    //State Changing Functions
    function contribute() payable external returns(bool) {

    }

    function claimFunds() external onlyOwner {

    }

    function requestRefund() external returns(bool){

    }

    //Read functions 
    function getAddressContribution() external view returns(uint256){

    }

    function getCampaignDetails() external view returns(
        string memory name,            // Campaign name
        string memory description,     // Campaign description
        uint256 goalAmount,           // Target amount
        uint16 duration,              // Duration in days
        uint256 timeRemaining,        // Time left in seconds
        uint256 remainingToGoal,      // Amount needed to reach goal
        uint256 totalRaised,          // Current amount raised
        address targetToken,          // Token being raised
        uint256 minDonation,         // Minimum donation amount
        bool isActive,                // Is campaign still active
        bool claimed                  // Have funds been claimed
    ){

    }

}