// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";

/**
 * @title DefiLibrary
 * @dev Library containing helper functions for the DefiIntegrationManager contract
 */
library DefiLibrary {
    using SafeERC20 for IERC20;

    /**
     * @dev Calculate minimum output amount based on expected output and slippage tolerance
     * @param expectedOut The expected output amount
     * @param slippageTolerance The slippage tolerance in basis points (e.g., 50 = 0.5%)
     * @return The minimum output amount after applying slippage
     */
    function calculateMinOutput(
        uint256 expectedOut,
        uint16 slippageTolerance
    ) internal pure returns (uint256) {
        return (expectedOut * (10000 - slippageTolerance)) / 10000;
    }

    /**
     * @dev Create Uniswap swap parameters structure
     * @param tokenIn The input token address
     * @param tokenOut The output token address
     * @param fee The fee tier (e.g., 3000 = 0.3%)
     * @param amountIn The input amount
     * @param amountOutMinimum The minimum output amount
     * @return params The Uniswap ExactInputSingleParams structure
     */
    function createSwapParams(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal view returns (ISwapRouter.ExactInputSingleParams memory params) {
        return
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 15 minutes,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
    }

    /**
     * @dev Validate that a token address is valid
     * @param token The token address to validate
     * @param registry The token registry to check against
     * @param isSupported Function to check if a token is supported
     * @return True if the token is valid, false otherwise
     */
    function validateToken(
        address token,
        address registry,
        function(address) external view returns (bool) isSupported
    ) internal view returns (bool) {
        if (token == address(0)) {
            return false;
        }

        return isSupported(token);
    }
}
