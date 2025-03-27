//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITokenRegistry.sol";
import "./IFeeManager.sol";
import "./IAavePool.sol";

/**
 * @title IDefiIntegrationManager
 * @author Generated with assistance from an LLM
 * @dev Interface for managing DeFi protocol integrations
 * @notice Handles interactions with yield-generating protocols like Aave for campaign funds
 */
interface IDefiIntegrationManager {
    /**
     * @notice Deposits tokens to the integrated yield protocol
     * @dev Transfers tokens from the caller and deposits them into the yield protocol
     * @param _token Address of the token to deposit
     * @param _amount Amount of tokens to deposit
     */
    function depositToYieldProtocol(address _token, uint256 _amount) external;

    /**
     * @notice Withdraws tokens from the yield protocol
     * @dev Withdraws tokens plus any accrued yield
     * @param _token Address of the token to withdraw
     * @param _campaignSuccessful Whether the associated campaign was successful
     * @param _coverRefunds Amount needed to cover potential refunds
     * @return Amount withdrawn including any accrued yield
     */
    function withdrawFromYieldProtocol(
        address _token,
        bool _campaignSuccessful,
        uint256 _coverRefunds
    ) external returns (uint256);

    /**
     * @notice Sets the token registry contract address
     * @dev Only callable by authorized admins
     * @param _tokenRegistry Address of the token registry contract
     */
    function setTokenRegistry(address _tokenRegistry) external;

    /**
     * @notice Sets the fee manager contract address
     * @dev Only callable by authorized admins
     * @param _feeManager Address of the fee manager contract
     */
    function setFeeManager(address _feeManager) external;

    /**
     * @notice Sets the Aave pool contract address
     * @dev Only callable by authorized admins
     * @param _aavePool Address of the Aave pool contract
     */
    function setAavePool(address _aavePool) external;

    /**
     * @notice Returns the current token registry contract
     * @return ITokenRegistry interface of the token registry
     */
    function tokenRegistry() external view returns (ITokenRegistry);

    /**
     * @notice Returns the current fee manager contract
     * @return IFeeManager interface of the fee manager
     */
    function feeManager() external view returns (IFeeManager);

    /**
     * @notice Returns the current Aave pool contract
     * @return IAavePool interface of the Aave pool
     */
    function aavePool() external view returns (IAavePool);

    /**
     * @notice Gets the current yield rate for a specific token
     * @param token Address of the token to query
     * @return yieldRate Current yield rate for the specified token
     */
    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate);

    /**
     * @notice Returns the platform treasury address
     * @return Address of the platform treasury
     */
    function getPlatformTreasury() external view returns (address);

    /**
     * @notice Gets the aToken address for a specific underlying token
     * @param _token Address of the underlying token
     * @return Address of the corresponding aToken
     */
    function getATokenAddress(address _token) external view returns (address);

    /**
     * @notice Returns the Aave balance for a specific user and token
     * @param _token Address of the token
     * @param _user Address of the user
     * @return User's balance of specified token in Aave
     */
    function aaveBalances(
        address _token,
        address _user
    ) external view returns (uint256);
}
