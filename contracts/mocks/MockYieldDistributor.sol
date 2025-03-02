//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockYieldDistributor {
    address public platformTreasury;
    uint256 public platformYieldShare = 2000; // 20% in basis points
    
    constructor(address _platformTreasury) {
        platformTreasury = _platformTreasury;
    }
    
    function calculateYieldShares(uint256 totalYield) 
        external 
        view 
        returns (uint256 creatorShare, uint256 platformShare) 
    {
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
    
    function setPlatformYieldShare(uint256 _share) external {
        platformYieldShare = _share;
    }
}