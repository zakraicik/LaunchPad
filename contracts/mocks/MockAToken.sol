//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAToken is ERC20 {
    address public underlyingAsset;
    
    constructor(
        string memory name,
        string memory symbol,
        address _underlyingAsset
    ) ERC20(name, symbol) {
        underlyingAsset = _underlyingAsset;
    }
    
    function mint(address user, uint256 amount) external {
        _mint(user, amount);
    }
    
    function burn(address user, uint256 amount) external {
        _burn(user, amount);
    }
}