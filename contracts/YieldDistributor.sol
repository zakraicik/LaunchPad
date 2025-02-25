//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract YieldDistributor is Ownable {

    address public platformTreasury;
    uint public platformYieldShare = 2000;
    uint public maximumYieldShare = 5000;

    error InvalidAddress();
    error InvalidShare(uint256 share);
    error ShareExceedsMaximum(uint256 share);
    error Overflow();

    event PlatformTreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformYieldShareUpdated(uint256 oldShare, uint256 newShare);
    event YieldDistributed(
        address indexed campaign,
        address indexed token,
        uint256 totalYield,
        uint256 creatorShare,
        uint256 platformShare
    );

    constructor(address _platformTreasury, address _owner) Ownable(_owner) {
        if(_platformTreasury == address(0)){
            revert InvalidAddress();
        }

        platformTreasury = _platformTreasury;
    }

    function updatePlatformTreasury(address _platformTreasury) external onlyOwner {
        if(_platformTreasury == address(0)){
            revert InvalidAddress();
        }

        address oldTreasury = platformTreasury;
        platformTreasury = _platformTreasury;

        emit PlatformTreasuryUpdated(oldTreasury, _platformTreasury);
    }

    function updatePlatformYieldShare(uint256 _platformYieldShare) external onlyOwner {
        if(_platformYieldShare > maximumYieldShare){
            revert ShareExceedsMaximum(_platformYieldShare);
        }

        uint256 oldshare = platformYieldShare;
        platformYieldShare = _platformYieldShare;
        
        emit PlatformYieldShareUpdated(oldshare,_platformYieldShare);
    }

    function calculateYieldShares(uint256 totalYield) 
        external 
        view 
        returns (uint256 creatorShare, uint256 platformShare) 
    {

        if (totalYield > 0 && platformYieldShare > 0 && 
            totalYield > type(uint256).max / platformYieldShare) {
            revert Overflow();
        }
        
        platformShare = (totalYield * platformYieldShare) / 10000;
        creatorShare = totalYield - platformShare;
        
        return (creatorShare, platformShare);
    }

    function getPlatformTreasury() external view returns (address) {
        return platformTreasury;
    }

    function getPlatformYieldShare() external view returns (uint256) {
        return platformYieldShare;
    }

    function getYieldSplitPreview(uint256 yieldAmount) 
        external 
        view 
        returns (uint256 creatorAmount, uint256 platformAmount) 
    {
       
        if (yieldAmount > 0 && platformYieldShare > 0 && 
            yieldAmount > type(uint256).max / platformYieldShare) {
            revert Overflow();
        }
        
        platformAmount = (yieldAmount * platformYieldShare) / 10000;
        creatorAmount = yieldAmount - platformAmount;
        
        return (creatorAmount, platformAmount);
    }
    
}