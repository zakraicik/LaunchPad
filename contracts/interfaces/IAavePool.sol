//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

/**
 * @title IAavePool
 * @author Generated with assistance from an LLM
 * @dev Interface for interacting with Aave V3 Pool
 * @notice Provides functions to supply assets, withdraw them, and query reserve data
 */
interface IAavePool {
    /**
     * @notice Supplies an amount of underlying asset to the Aave protocol
     * @dev The user must have approved the contract with the ERC20 allowance mechanism
     * @param asset The address of the underlying asset to supply
     * @param amount The amount to be supplied
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraws an amount of underlying asset from the Aave protocol
     * @dev The caller must have enough aTokens to burn
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     * @param to Address that will receive the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Returns the state of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve data
     */
    function getReserveData(
        address asset
    ) external view returns (DataTypes.ReserveData memory);
}
