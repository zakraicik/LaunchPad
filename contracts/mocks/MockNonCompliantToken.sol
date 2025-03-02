//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockNonCompliantToken {
    string public name = "Non Compliant Token";
    string public symbol = "NCT";
    
    // Missing decimals function
    
    // This will cause TypeErrors when TokenRegistry tries to check it
    function balanceOf() external pure returns (uint256) {
        return 0;
    }
    
    // This function will revert when called
    function transfer() external pure returns (bool) {
        revert("Not implemented");
    }
    
    // Missing other ERC20 functions
}