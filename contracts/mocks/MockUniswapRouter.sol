//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapRouter.sol";

contract MockUniswapRouter is ISwapRouter {
    bool public shouldFailSwap = false;
    bool public shouldReturnLessThanMinimum = false;
    uint256 public swapRate = 2; // One tokenIn gives 2 tokenOut by default
    
    mapping(address => mapping(address => uint256)) public customSwapRates; // fromToken -> toToken -> rate
    
    event SwapPerformed(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    
    // Configuration functions
    function setShouldFailSwap(bool _shouldFail) external {
        shouldFailSwap = _shouldFail;
    }
    
    function setShouldReturnLessThanMinimum(bool _shouldReturn) external {
        shouldReturnLessThanMinimum = _shouldReturn;
    }
    
    function setSwapRate(uint256 _swapRate) external {
        swapRate = _swapRate;
    }
    
    function setCustomSwapRate(address fromToken, address toToken, uint256 rate) external {
        customSwapRates[fromToken][toToken] = rate;
    }
    
    // ISwapRouter implementation
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        override
        returns (uint256 amountOut)
    {
        if (shouldFailSwap) {
            revert("Swap failed");
        }
        
        // Calculate output amount
        uint256 outputRate = customSwapRates[params.tokenIn][params.tokenOut];
        if (outputRate == 0) {
            outputRate = swapRate;
        }
        
        uint256 outAmount = params.amountIn * outputRate;
        
        // Check if we should return less than the minimum
        if (shouldReturnLessThanMinimum && params.amountOutMinimum > 0) {
            outAmount = params.amountOutMinimum - 1;
        }
        
        // Transfer tokens
        bool success = IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        require(success, "Transfer of input token failed");
        
        success = IERC20(params.tokenOut).transfer(params.recipient, outAmount);
        require(success, "Transfer of output token failed");
        
        emit SwapPerformed(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            outAmount,
            params.recipient
        );
        
        return outAmount;
    }
    
    // Additional required functions from the interface
    function exactInput(ISwapRouter.ExactInputParams calldata params) external override returns (uint256 amountOut) {
        revert("Not implemented");
    }
    
    function exactOutputSingle(ISwapRouter.ExactOutputSingleParams calldata params)
        external
        override
        returns (uint256 amountIn)
    {
        revert("Not implemented");
    }
    
    function exactOutput(ISwapRouter.ExactOutputParams calldata params) external override returns (uint256 amountIn) {
        revert("Not implemented");
    }
}