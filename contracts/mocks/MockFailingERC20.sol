//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFailingERC20 is ERC20 {
    bool public transferShouldFail = false;
    bool public shouldFailAllowance = false;
    
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
    
    function setTransferShouldFail(bool shouldFail) external {
        transferShouldFail = shouldFail;
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (transferShouldFail) {
            return false;
        }
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (transferShouldFail) {
            return false;
        }
        return super.transferFrom(from, to, amount);
    }

    function setShouldFailAllowance(bool _fail) external {
        shouldFailAllowance = _fail;
    }

}