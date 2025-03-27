// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ITokenRegistry
 * @author Generated with assistance from an LLM
 * @dev Interface for managing supported tokens and their configurations
 * @notice Handles supported token list, minimum contribution amounts, and token-related utilities
 */
interface ITokenRegistry {
    /**
     * @notice Configuration struct for each token
     * @param isSupported Whether the token is currently supported
     * @param decimals Number of decimals the token uses
     * @param minimumContributionAmount Minimum amount required for contributions in token's smallest unit
     */
    struct TokenConfig {
        bool isSupported;
        uint8 decimals;
        uint256 minimumContributionAmount;
    }

    /**
     * @notice Checks if a token is supported by the platform
     * @param token Address of the token to check
     * @return True if the token is supported, false otherwise
     */
    function isTokenSupported(address token) external view returns (bool);

    /**
     * @notice Gets the minimum contribution amount for a specific token
     * @param token Address of the token to query
     * @return minimumAmount Minimum contribution amount in token's smallest unit
     * @return decimals Number of decimals for the token
     */
    function getMinContributionAmount(
        address token
    ) external view returns (uint256 minimumAmount, uint8 decimals);

    /**
     * @notice Returns all supported token addresses
     * @return Array of supported token addresses
     */
    function getAllSupportedTokens() external view returns (address[] memory);

    /**
     * @notice Gets the decimal places for a specific token
     * @param token Address of the token to query
     * @return Number of decimal places for the token
     */
    function getTokenDecimals(address token) external view returns (uint8);

    /**
     * @notice Adds a new token to the registry
     * @dev Only callable by authorized admins
     * @param _token Address of the token to add
     * @param _minimumContributionInWholeTokens Minimum contribution amount in whole tokens
     */
    function addToken(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external;

    /**
     * @notice Removes a token from the registry
     * @dev Only callable by authorized admins
     * @param _token Address of the token to remove
     */
    function removeToken(address _token) external;

    /**
     * @notice Disables support for a token without removing it
     * @dev Only callable by authorized admins
     * @param _token Address of the token to disable
     */
    function disableTokenSupport(address _token) external;

    /**
     * @notice Enables support for a previously added token
     * @dev Only callable by authorized admins
     * @param _token Address of the token to enable
     */
    function enableTokenSupport(address _token) external;

    /**
     * @notice Updates the minimum contribution amount for a token
     * @dev Only callable by authorized admins
     * @param _token Address of the token to update
     * @param _minimumContributionInWholeTokens New minimum contribution amount in whole tokens
     */
    function updateTokenMinimumContribution(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external;

    /**
     * @notice Utility function to convert from smallest token unit to whole tokens
     * @dev Used for testing and verification
     * @param amount Amount in smallest token unit
     * @param decimals Number of decimals for the token
     * @return Converted amount in whole tokens
     */
    function testConvertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) external pure returns (uint256);

    /**
     * @notice Returns the configuration for a specific token
     * @param token Address of the token to query
     * @return isSupported Whether the token is currently supported
     * @return decimals Number of decimals the token uses
     * @return minimumContributionAmount Minimum contribution amount in token's smallest unit
     */
    function tokenConfigs(
        address token
    )
        external
        view
        returns (
            bool isSupported,
            uint8 decimals,
            uint256 minimumContributionAmount
        );

    /**
     * @notice Returns the token address at a specific index in the supported tokens array
     * @param index Index in the supported tokens array
     * @return Address of the token at the specified index
     */
    function supportedTokens(uint256 index) external view returns (address);
}
