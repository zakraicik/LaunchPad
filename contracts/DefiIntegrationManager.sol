//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IYieldDistributor.sol";
import "./interfaces/IAavePool.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

contract DefiIntegrationManager is
    Ownable,
    ReentrancyGuard,
    PlatformAdminAccessControl
{
    using SafeERC20 for IERC20;

    // Operation types for events
    uint8 private constant OP_YIELD_DEPOSITED = 1;
    uint8 private constant OP_YIELD_WITHDRAWN = 2;
    uint8 private constant OP_YIELD_HARVESTED = 3;
    uint8 private constant OP_CONFIG_UPDATED = 4;

    // Error codes
    uint8 private constant ERR_UNAUTHORIZED = 1;
    uint8 private constant ERR_ZERO_AMOUNT = 2;
    uint8 private constant ERR_INSUFFICIENT_DEPOSIT = 3;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 4;
    uint8 private constant ERR_YIELD_DEPOSIT_FAILED = 5;
    uint8 private constant ERR_YIELD_WITHDRAWAL_FAILED = 6;
    uint8 private constant ERR_INVALID_ADDRESS = 7;
    uint8 private constant ERR_INVALID_CONSTRUCTOR = 8;
    uint8 private constant ERR_NO_YIELD = 9;
    uint8 private constant ERR_WITHDRAWAL_MISMATCH = 10;
    uint8 private constant ERR_FAILED_GET_ATOKEN = 11;

    // External contracts
    IAavePool public aavePool;
    ITokenRegistry public tokenRegistry;
    IYieldDistributor public yieldDistributor;

    // Storage
    mapping(address => mapping(address => uint256)) public aaveDeposits;

    // Consolidated error
    error DefiError(uint8 code, address addr, uint256 value);

    // Consolidated event
    event DefiOperation(
        uint8 opType,
        address indexed sender,
        address indexed token,
        address indexed secondToken,
        uint256 amount,
        uint256 secondAmount
    );

    // Configuration update event
    event ConfigUpdated(
        uint8 configType,
        address oldAddress,
        address newAddress
    );

    constructor(
        address _aavePool,
        address _tokenRegistry,
        address _yieldDistributor,
        address _platformAdmin,
        address _owner
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_aavePool == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _aavePool, 0);
        }

        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _tokenRegistry, 3);
        }

        if (_yieldDistributor == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _yieldDistributor, 4);
        }

        aavePool = IAavePool(_aavePool);
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        yieldDistributor = IYieldDistributor(_yieldDistributor);
    }

    function setTokenRegistry(
        address _tokenRegistry
    ) external onlyPlatformAdmin {
        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _tokenRegistry, 0);
        }

        address oldRegistry = address(tokenRegistry);
        tokenRegistry = ITokenRegistry(_tokenRegistry);

        emit ConfigUpdated(1, oldRegistry, _tokenRegistry);
    }

    function setYieldDistributor(
        address _yieldDistributor
    ) external onlyPlatformAdmin {
        if (_yieldDistributor == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _yieldDistributor, 0);
        }

        address oldDistributor = address(yieldDistributor);
        yieldDistributor = IYieldDistributor(_yieldDistributor);

        emit ConfigUpdated(2, oldDistributor, _yieldDistributor);
    }

    function setAavePool(address _aavePool) external onlyPlatformAdmin {
        if (_aavePool == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _aavePool, 0);
        }

        address oldAavePool = address(aavePool);
        aavePool = IAavePool(_aavePool);

        emit ConfigUpdated(3, oldAavePool, _aavePool);
    }

    function depositToYieldProtocol(
        address _token,
        uint256 _amount
    ) external nonReentrant {
        address aToken = getATokenAddress(_token);

        if (aToken == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, aToken, 0);
        }

        if (_amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token, _amount);
        }

        if (!tokenRegistry.isTokenSupported(_token)) {
            revert DefiError(ERR_TOKEN_NOT_SUPPORTED, _token, 0);
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(address(aavePool), _amount);

        try aavePool.supply(_token, _amount, msg.sender, 0) {
            if (aToken == address(0)) {
                revert DefiError(ERR_INVALID_ADDRESS, aToken, 0);
            }

            uint256 aTokenBalance = IERC20(aToken).balanceOf(msg.sender);

            aaveDeposits[msg.sender][_token] += aTokenBalance;

            emit DefiOperation(
                OP_YIELD_DEPOSITED,
                msg.sender,
                _token,
                address(0),
                _amount,
                0
            );
        } catch {
            revert DefiError(ERR_YIELD_DEPOSIT_FAILED, _token, _amount);
        }
    }

    function withdrawFromYieldProtocol(
        address _token,
        uint256 _amount
    ) external nonReentrant returns (uint256) {
        if (_amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token, _amount);
        }

        uint256 deposited = aaveDeposits[msg.sender][_token];
        if (_amount > deposited) {
            revert DefiError(ERR_INSUFFICIENT_DEPOSIT, _token, _amount);
        }

        try aavePool.withdraw(_token, _amount, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != _amount) {
                revert DefiError(ERR_WITHDRAWAL_MISMATCH, _token, _amount);
            }

            aaveDeposits[msg.sender][_token] -= _amount;
            IERC20(_token).safeTransfer(msg.sender, withdrawn);

            emit DefiOperation(
                OP_YIELD_WITHDRAWN,
                msg.sender,
                _token,
                address(0),
                withdrawn,
                0
            );

            return withdrawn;
        } catch {
            revert DefiError(ERR_YIELD_WITHDRAWAL_FAILED, _token, _amount);
        }
    }

    function withdrawAllFromYieldProtocol(
        address _token
    ) external nonReentrant returns (uint256) {
        uint256 amount = aaveDeposits[msg.sender][_token];

        if (amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token, amount);
        }

        try aavePool.withdraw(_token, amount, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != amount) {
                revert DefiError(ERR_WITHDRAWAL_MISMATCH, _token, amount);
            }

            aaveDeposits[msg.sender][_token] = 0;
            IERC20(_token).safeTransfer(msg.sender, withdrawn);

            emit DefiOperation(
                OP_YIELD_WITHDRAWN,
                msg.sender,
                _token,
                address(0),
                withdrawn,
                0
            );

            return withdrawn;
        } catch {
            revert DefiError(ERR_YIELD_WITHDRAWAL_FAILED, _token, amount);
        }
    }

    function harvestYield(
        address _token
    )
        external
        nonReentrant
        returns (uint256 creatorYield, uint256 platformYield)
    {
        // Check if user has any deposits
        if (aaveDeposits[msg.sender][_token] <= 0) {
            revert DefiError(ERR_INSUFFICIENT_DEPOSIT, _token, 0);
        }

        // Cache external calls
        address aTokenAddress = getATokenAddress(_token);
        if (aTokenAddress == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, aTokenAddress, 0);
        }

        // Get current balance
        IERC20 aToken = IERC20(aTokenAddress);
        uint256 receivedATokens = aToken.balanceOf(address(this));
        if (receivedATokens == 0) {
            revert DefiError(ERR_NO_YIELD, _token, 0);
        }

        // Withdraw tokens
        try aavePool.withdraw(_token, receivedATokens, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != receivedATokens) {
                revert DefiError(
                    ERR_WITHDRAWAL_MISMATCH,
                    _token,
                    receivedATokens
                );
            }

            // Calculate and distribute yield
            (creatorYield, platformYield) = yieldDistributor
                .calculateYieldShares(withdrawn);
            address treasury = yieldDistributor.platformTreasury();

            // Transfer tokens
            IERC20 token = IERC20(_token);
            token.safeTransfer(msg.sender, creatorYield);
            token.safeTransfer(treasury, platformYield);

            emit DefiOperation(
                OP_YIELD_HARVESTED,
                msg.sender,
                _token,
                treasury,
                creatorYield,
                platformYield
            );
        } catch {
            revert DefiError(
                ERR_YIELD_WITHDRAWAL_FAILED,
                _token,
                receivedATokens
            );
        }
    }

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

    function getDepositedAmount(
        address campaign,
        address token
    ) external view returns (uint256 amount) {
        if (campaign == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, campaign, 0);
        }

        if (token == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, token, 0);
        }

        if (!tokenRegistry.isTokenSupported(token)) {
            revert DefiError(ERR_TOKEN_NOT_SUPPORTED, token, 0);
        }

        return aaveDeposits[campaign][token];
    }

    function getCurrentYield(
        address campaign,
        address token
    ) external view returns (uint256 yieldAmount) {
        uint256 deposited = aaveDeposits[campaign][token];
        if (deposited == 0) {
            return 0;
        }

        address aToken;
        try aavePool.getReserveData(token) returns (
            DataTypes.ReserveData memory data
        ) {
            aToken = data.aTokenAddress;
        } catch {
            return 0;
        }

        if (aToken == address(0)) {
            return 0;
        }

        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance <= deposited) {
            return 0;
        }

        return aTokenBalance - deposited;
    }

    function getPlatformTreasury() external view returns (address) {
        return yieldDistributor.platformTreasury();
    }

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
