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
        uint32 _campaignGoalAmount,
        uint16 _campaignDuration,
        string memory _campaignName,
        string memory _campaignDescription,
        address _campaignTargetToken,
        uint32 _campaignMinimumDonation,
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

}