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

    // Status and operation constants (packed into single bytes)
    uint8 private constant OP_DEPOSITED = 1;
    uint8 private constant OP_WITHDRAWN_TO_CONTRACT = 2;
    uint8 private constant OP_TOKEN_REGISTRY_UPDATED = 3;
    uint8 private constant OP_FEE_MANAGER_UPDATED = 4;
    uint8 private constant OP_AAVE_POOL_UPDATED = 5;
    uint8 private constant OP_WITHDRAWN_TO_PLATFORM_TREASURY = 6;

    // Error codes
    uint8 private constant ERR_ZERO_AMOUNT = 1;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;
    uint8 private constant ERR_DEPOSIT_FAILED = 3;
    uint8 private constant ERR_WITHDRAWAL_FAILED = 4;
    uint8 private constant ERR_INVALID_ADDRESS = 5;
    uint8 private constant ERR_INVALID_CONSTRUCTOR = 6;
    uint8 private constant ERR_WITHDRAWAL_DOESNT_BALANCE = 7;

    //Interfaces
    IAavePool public aavePool;
    ITokenRegistry public tokenRegistry;
    IFeeManager public feeManager;

    //State variables
    mapping(address => mapping(address => uint256)) public aaveBalances;

    /**
     * @notice Thrown when a DeFi operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     */
    error DefiError(uint8 code, address addr);
    /**
     * @notice Thrown when a deposit to a yield protocol fails
     * @param code Error code identifying the failure reason
     * @param campaignId Unique identifier of the campaign related to this operation
     * @param token Address of the token being deposited
     * @param amount Amount of tokens being deposited
     */
    error DeposittoYieldProtocolError(
        uint8 code,
        address token,
        uint256 amount,
        bytes32 campaignId
    );
    /**
     * @notice Thrown when a withdrawal from a yield protocol fails
     * @param code Error code identifying the failure reason
     * @param campaignId Unique identifier of the campaign related to this operation
     * @param token Address of the token being withdrawn
     * @param amount Amount of tokens being withdrawn or requested to withdraw
     */
    error WithdrawFromYieldProtocolError(
        uint8 code,
        address token,
        uint256 amount,
        bytes32 campaignId
    );

    /**
     * @notice Emitted when a DeFi operation is performed
     * @param opType Type of operation (1=deposit, 2=withdraw, 3=config_updated)
     * @param sender Address initiating the operation
     * @param token Token involved in the operation
     * @param amount Amount of tokens involved in the operation
     * @param campaignId Unique identifier of the campaign related to this operation
     */
    event DefiOperation(
        uint8 opType,
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes32 indexed campaignId
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

        emit ConfigUpdated(
            OP_TOKEN_REGISTRY_UPDATED,
            oldRegistry,
            _tokenRegistry
        );
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

        emit ConfigUpdated(OP_FEE_MANAGER_UPDATED, oldFeeManager, _feeManager);
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

        emit ConfigUpdated(OP_AAVE_POOL_UPDATED, oldAavePool, _aavePool);
    }

    /**
     * @notice Deposits tokens to Aave for yield generation
     * @dev Transfers tokens from sender to this contract, then supplies to Aave
     * @param _token Address of the token to deposit
     * @param _amount Amount of tokens to deposit
     * @param campaignId Unique identifier of the campaign related to this operation
     */
    function depositToYieldProtocol(
        address _token,
        uint256 _amount,
        bytes32 campaignId
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
            revert DeposittoYieldProtocolError(
                ERR_TOKEN_NOT_SUPPORTED,
                _token,
                _amount,
                campaignId
            );
        }
        address aToken = getATokenAddress(_token);

        if (aToken == address(0)) {
            revert DeposittoYieldProtocolError(
                ERR_INVALID_ADDRESS,
                aToken,
                _amount,
                campaignId
            );
        }

        if (_amount <= 0) {
            revert DeposittoYieldProtocolError(
                ERR_ZERO_AMOUNT,
                _token,
                _amount,
                campaignId
            );
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(address(aavePool), _amount);

        try aavePool.supply(_token, _amount, msg.sender, 0) {
            aaveBalances[_token][msg.sender] += _amount;

            emit DefiOperation(
                OP_DEPOSITED,
                msg.sender,
                _token,
                _amount,
                campaignId
            );
        } catch {
            revert DeposittoYieldProtocolError(
                ERR_DEPOSIT_FAILED,
                _token,
                _amount,
                campaignId
            );
        }
    }

    /**
     * @notice Withdraws tokens from Aave and distributes funds based on campaign success
     * @dev Withdraws all tokens from Aave and splits between creator and platform based on campaign outcome
     * @param _token Address of the token to withdraw
     * @param campaignSuccessful Whether the campaign met its goal
     * @param coverRefunds Amount needed to cover potential refunds
     * @param campaignId Unique identifier of the campaign related to this operation
     * @return Amount withdrawn including any accrued yield
     */
    function withdrawFromYieldProtocol(
        address _token,
        bool campaignSuccessful,
        uint256 coverRefunds,
        bytes32 campaignId
    ) external nonReentrant whenNotPaused returns (uint256) {
        address aTokenAddress = getATokenAddress(_token);

        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));

        try aavePool.withdraw(_token, type(uint).max, address(this)) returns (
            uint256 withdrawn
        ) {
            if (aTokenBalance != withdrawn) {
                revert WithdrawFromYieldProtocolError(
                    ERR_WITHDRAWAL_DOESNT_BALANCE,
                    _token,
                    aTokenBalance,
                    campaignId
                );
            }

            if (campaignSuccessful) {
                (uint256 creatorShare, uint256 platformShare) = feeManager
                    .calculateFeeShares(withdrawn);

                IERC20(_token).safeTransfer(msg.sender, creatorShare);
                IERC20(_token).safeTransfer(
                    feeManager.platformTreasury(),
                    platformShare
                );

                emit DefiOperation(
                    OP_WITHDRAWN_TO_PLATFORM_TREASURY,
                    feeManager.platformTreasury(),
                    _token,
                    platformShare,
                    campaignId
                );

                emit DefiOperation(
                    OP_WITHDRAWN_TO_CONTRACT,
                    msg.sender,
                    _token,
                    creatorShare,
                    campaignId
                );

            } else {
                uint256 remaining = withdrawn - coverRefunds;

                IERC20(_token).safeTransfer(msg.sender, coverRefunds);
                IERC20(_token).safeTransfer(
                    feeManager.platformTreasury(),
                    remaining
                );

                emit DefiOperation(
                    OP_WITHDRAWN_TO_PLATFORM_TREASURY,
                    feeManager.platformTreasury(),
                    _token,
                    remaining,
                    campaignId
                );

                emit DefiOperation(
                    OP_WITHDRAWN_TO_CONTRACT,
                    msg.sender,
                    _token,
                    coverRefunds,
                    campaignId
                );
            }

            aaveBalances[_token][msg.sender] = 0;

            return withdrawn;
        } catch {
            revert WithdrawFromYieldProtocolError(
                ERR_WITHDRAWAL_FAILED,
                _token,
                aTokenBalance,
                campaignId
            );
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
