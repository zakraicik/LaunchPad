//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IQuoter.sol";

contract MockUniswapQuoter is IQuoter {
    bool public shouldFailQuote = false;
    uint256 public defaultQuoteRate = 2; // 1 tokenIn gets 2 tokenOut by default
    
    mapping(address => mapping(address => uint256)) public customQuoteRates; // fromToken -> toToken -> rate
    mapping(address => mapping(address => bool)) public shouldFailSpecificPair; // fromToken -> toToken -> shouldFail
    
    // Configuration functions
    function setShouldFailQuote(bool _shouldFail) external {
        shouldFailQuote = _shouldFail;
    }
    
    function setDefaultQuoteRate(uint256 _rate) external {
        defaultQuoteRate = _rate;
    }
    
    function setCustomQuoteRate(address fromToken, address toToken, uint256 rate) external {
        customQuoteRates[fromToken][toToken] = rate;
    }
    
    function setFailForSpecificPair(address fromToken, address toToken, bool shouldFail) external {
        shouldFailSpecificPair[fromToken][toToken] = shouldFail;
    }
    
    // IQuoter implementation
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external view override returns (uint256 amountOut) {
        if (shouldFailQuote || shouldFailSpecificPair[tokenIn][tokenOut]) {
            revert("Quote failed");
        }
        
        // Calculate output amount
        uint256 rate = customQuoteRates[tokenIn][tokenOut];
        if (rate == 0) {
            rate = defaultQuoteRate;
        }
        
        return amountIn * rate;
    }
    
    // Other functions from the interface
    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        revert("Not implemented");
    }
    
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) external view override returns (uint256 amountIn) {
        revert("Not implemented");
    }
    
    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        view
        override
        returns (uint256 amountIn)
    {
        revert("Not implemented");
    }
}