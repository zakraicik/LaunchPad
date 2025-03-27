//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IFeeManager.sol";
import "./interfaces/IAavePool.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./abstracts/PausableControl.sol";

/**
 * @title DefiIntegrationManager
 * @author Generated with assistance from an LLM
 * @notice Manages interactions with DeFi protocols for yield generation
 * @dev Handles deposits and withdrawals to Aave for campaign funds
 */
contract DefiIntegrationManager is
    Ownable,
    ReentrancyGuard,
    PlatformAdminAccessControl,
    PausableControl
{
    using SafeERC20 for IERC20;

    // Operation types for events
    /**
     * @dev Constant defining deposit operation type for events
     */
    uint8 private constant OP_DEPOSITED = 1;

    /**
     * @dev Constant defining withdrawal operation type for events
     */
    uint8 private constant OP_WITHDRAWN = 2;

    /**
     * @dev Constant defining configuration update operation type for events
     */
    uint8 private constant OP_CONFIG_UPDATED = 3;

    // Error codes
    /**
     * @dev Error code for zero amount
     */
    uint8 private constant ERR_ZERO_AMOUNT = 1;

    /**
     * @dev Error code for unsupported token
     */
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;

    /**
     * @dev Error code for failed deposit
     */
    uint8 private constant ERR_DEPOSIT_FAILED = 3;

    /**
     * @dev Error code for failed withdrawal
     */
    uint8 private constant ERR_WITHDRAWAL_FAILED = 4;

    /**
     * @dev Error code for invalid address
     */
    uint8 private constant ERR_INVALID_ADDRESS = 5;

    /**
     * @dev Error code for invalid constructor parameters
     */
    uint8 private constant ERR_INVALID_CONSTRUCTOR = 6;

    /**
     * @dev Error code for withdrawal amount mismatch
     */
    uint8 private constant ERR_WITHDRAWAL_DOESNT_BALANCE = 7;

    // External contracts
    /**
     * @notice Reference to the Aave Pool contract
     * @dev Used for interacting with Aave protocol
     */
    IAavePool public aavePool;

    /**
     * @notice Reference to the TokenRegistry contract
     * @dev Used for validating tokens
     */
    ITokenRegistry public tokenRegistry;

    /**
     * @notice Reference to the FeeManager contract
     * @dev Used for fee calculations and platform treasury
     */
    IFeeManager public feeManager;

    /**
     * @notice Tracks user balances deposited to Aave
     * @dev Mapping from token => user => amount
     */
    mapping(address => mapping(address => uint256)) public aaveBalances;

    /**
     * @notice Thrown when a DeFi operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     */
    error DefiError(uint8 code, address addr);

    /**
     * @notice Emitted when a DeFi operation is performed
     * @param opType Type of operation (1=deposit, 2=withdraw)
     * @param sender Address initiating the operation
     * @param token Primary token involved
     * @param secondToken Secondary token involved (if applicable)
     * @param amount Primary amount involved
     * @param secondAmount Secondary amount involved (if applicable)
     */
    event DefiOperation(
        uint8 opType,
        address indexed sender,
        address indexed token,
        address indexed secondToken,
        uint256 amount,
        uint256 secondAmount
    );

    /**
     * @notice Emitted when a configuration is updated
     * @param configType Type of configuration updated
     * @param oldAddress Previous address
     * @param newAddress New address
     */
    event ConfigUpdated(
        uint8 configType,
        address oldAddress,
        address newAddress
    );

    /**
     * @notice Creates a new DefiIntegrationManager contract
     * @dev Sets up initial contract references and validates parameters
     * @param _aavePool Address of the Aave Pool contract
     * @param _tokenRegistry Address of the TokenRegistry contract
     * @param _feeManager Address of the FeeManager contract
     * @param _platformAdmin Address of the PlatformAdmin contract
     * @param _owner Address of the contract owner
     */
    constructor(
        address _aavePool,
        address _tokenRegistry,
        address _feeManager,
        address _platformAdmin,
        address _owner
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_aavePool == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _aavePool);
        }

        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _tokenRegistry);
        }

        if (_feeManager == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _feeManager);
        }

        if (_platformAdmin == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _platformAdmin);
        }

        aavePool = IAavePool(_aavePool);
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        feeManager = IFeeManager(_feeManager);
    }

    /**
     * @notice Updates the TokenRegistry contract reference
     * @dev Only callable by platform admins
     * @param _tokenRegistry Address of the new TokenRegistry contract
     */
    function setTokenRegistry(
        address _tokenRegistry
    ) external onlyPlatformAdmin {
        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _tokenRegistry);
        }

        address oldRegistry = address(tokenRegistry);
        tokenRegistry = ITokenRegistry(_tokenRegistry);

        emit ConfigUpdated(OP_CONFIG_UPDATED, oldRegistry, _tokenRegistry);
    }

    /**
     * @notice Updates the FeeManager contract reference
     * @dev Only callable by platform admins
     * @param _feeManager Address of the new FeeManager contract
     */
    function setFeeManager(address _feeManager) external onlyPlatformAdmin {
        if (_feeManager == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _feeManager);
        }

        address oldFeeManager = address(feeManager);
        feeManager = IFeeManager(_feeManager);

        emit ConfigUpdated(OP_CONFIG_UPDATED, oldFeeManager, _feeManager);
    }

    /**
     * @notice Updates the Aave Pool contract reference
     * @dev Only callable by platform admins
     * @param _aavePool Address of the new Aave Pool contract
     */
    function setAavePool(address _aavePool) external onlyPlatformAdmin {
        if (_aavePool == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _aavePool);
        }

        address oldAavePool = address(aavePool);
        aavePool = IAavePool(_aavePool);

        emit ConfigUpdated(OP_CONFIG_UPDATED, oldAavePool, _aavePool);
    }

    /**
     * @notice Deposits tokens to Aave for yield generation
     * @dev Transfers tokens from sender to this contract, then supplies to Aave
     * @param _token Address of the token to deposit
     * @param _amount Amount of tokens to deposit
     */
    function depositToYieldProtocol(
        address _token,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        bool tokenExists;
        bool isSupported;
        try tokenRegistry.isTokenSupported(_token) returns (bool supported) {
            tokenExists = true;
            isSupported = supported;
        } catch {
            tokenExists = false;
        }

        if (!tokenExists || !isSupported) {
            revert DefiError(ERR_TOKEN_NOT_SUPPORTED, _token);
        }
        address aToken = getATokenAddress(_token);

        if (aToken == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, aToken);
        }

        if (_amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token);
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(address(aavePool), _amount);

        try aavePool.supply(_token, _amount, msg.sender, 0) {
            aaveBalances[_token][msg.sender] += _amount;

            emit DefiOperation(
                OP_DEPOSITED,
                msg.sender,
                _token,
                address(0),
                _amount,
                0
            );
        } catch {
            revert DefiError(ERR_DEPOSIT_FAILED, _token);
        }
    }

    /**
     * @notice Withdraws tokens from Aave and distributes funds based on campaign success
     * @dev Withdraws all tokens from Aave and splits between creator and platform based on campaign outcome
     * @param _token Address of the token to withdraw
     * @param campaignSuccessful Whether the campaign met its goal
     * @param coverRefunds Amount needed to cover potential refunds
     * @return Amount withdrawn including any accrued yield
     */
    function withdrawFromYieldProtocol(
        address _token,
        bool campaignSuccessful,
        uint256 coverRefunds
    ) external nonReentrant whenNotPaused returns (uint256) {
        address aTokenAddress = getATokenAddress(_token);

        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));

        try aavePool.withdraw(_token, type(uint).max, address(this)) returns (
            uint256 withdrawn
        ) {
            if (aTokenBalance != withdrawn) {
                revert DefiError(ERR_WITHDRAWAL_DOESNT_BALANCE, _token);
            }

            if (campaignSuccessful) {
                (uint256 creatorShare, uint256 platformShare) = feeManager
                    .calculateFeeShares(withdrawn);

                IERC20(_token).safeTransfer(msg.sender, creatorShare);
                IERC20(_token).safeTransfer(
                    feeManager.platformTreasury(),
                    platformShare
                );
            } else {
                uint256 remaining = withdrawn - coverRefunds;

                IERC20(_token).safeTransfer(msg.sender, coverRefunds);
                IERC20(_token).safeTransfer(
                    feeManager.platformTreasury(),
                    remaining
                );
            }

            aaveBalances[_token][msg.sender] = 0;

            emit DefiOperation(
                OP_WITHDRAWN,
                msg.sender,
                _token,
                address(0),
                withdrawn,
                0
            );

            return withdrawn;
        } catch {
            revert DefiError(ERR_WITHDRAWAL_FAILED, _token);
        }
    }

    /**
     * @notice Gets the current yield rate for a specific token
     * @dev Queries Aave for the current liquidity rate and converts to basis points
     * @param token Address of the token to query
     * @return yieldRate Current yield rate in basis points (e.g., 250 = 2.5%)
     */
    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate) {
        try aavePool.getReserveData(token) returns (
            DataTypes.ReserveData memory data
        ) {
            return (data.currentLiquidityRate * 10000) / 1e27;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Gets the platform treasury address
     * @dev Queries the FeeManager for the current treasury address
     * @return Address of the platform treasury
     */
    function getPlatformTreasury() external view returns (address) {
        return feeManager.platformTreasury();
    }

    /**
     * @notice Gets the aToken address for a specific underlying token
     * @dev Queries Aave for the aToken corresponding to the provided token
     * @param _token Address of the underlying token
     * @return Address of the corresponding aToken, or zero address if not found
     */
    function getATokenAddress(address _token) public view returns (address) {
        try aavePool.getReserveData(_token) returns (
            DataTypes.ReserveData memory data
        ) {
            return data.aTokenAddress;
        } catch {
            return address(0);
        }
    }
}
