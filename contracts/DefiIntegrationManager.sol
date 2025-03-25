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
    uint8 private constant OP_DEPOSITED = 1;
    uint8 private constant OP_WITHDRAWN = 2;
    uint8 private constant OP_CONFIG_UPDATED = 3;

    // Error codes
    uint8 private constant ERR_ZERO_AMOUNT = 1;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;
    uint8 private constant ERR_DEPOSIT_FAILED = 3;
    uint8 private constant ERR_WITHDRAWAL_FAILED = 4;
    uint8 private constant ERR_INVALID_ADDRESS = 5;
    uint8 private constant ERR_INVALID_CONSTRUCTOR = 6;

    // External contracts
    IAavePool public aavePool;
    ITokenRegistry public tokenRegistry;
    IYieldDistributor public yieldDistributor;

    mapping(address => mapping(address => uint256)) public aaveBalances;

    // Consolidated error
    error DefiError(uint8 code, address addr);

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
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _aavePool);
        }

        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _tokenRegistry);
        }

        if (_yieldDistributor == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _yieldDistributor);
        }

        if (_platformAdmin == address(0)) {
            revert DefiError(ERR_INVALID_CONSTRUCTOR, _platformAdmin);
        }

        aavePool = IAavePool(_aavePool);
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        yieldDistributor = IYieldDistributor(_yieldDistributor);
    }

    function setTokenRegistry(
        address _tokenRegistry
    ) external onlyPlatformAdmin {
        if (_tokenRegistry == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _tokenRegistry);
        }

        address oldRegistry = address(tokenRegistry);
        tokenRegistry = ITokenRegistry(_tokenRegistry);

        emit ConfigUpdated(1, oldRegistry, _tokenRegistry);
    }

    function setYieldDistributor(
        address _yieldDistributor
    ) external onlyPlatformAdmin {
        if (_yieldDistributor == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _yieldDistributor);
        }

        address oldDistributor = address(yieldDistributor);
        yieldDistributor = IYieldDistributor(_yieldDistributor);

        emit ConfigUpdated(2, oldDistributor, _yieldDistributor);
    }

    function setAavePool(address _aavePool) external onlyPlatformAdmin {
        if (_aavePool == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, _aavePool);
        }

        address oldAavePool = address(aavePool);
        aavePool = IAavePool(_aavePool);

        emit ConfigUpdated(3, oldAavePool, _aavePool);
    }

    function depositToYieldProtocol(
        address _token,
        uint256 _amount
    ) external nonReentrant {
        bool tokenExists;
        try tokenRegistry.isTokenSupported(_token) {
            tokenExists = true;
        } catch {
            tokenExists = false;
        }

        if (!tokenExists) {
            revert DefiError(ERR_TOKEN_NOT_SUPPORTED, _token);
        }

        address aToken = getATokenAddress(_token);

        if (aToken == address(0)) {
            revert DefiError(ERR_INVALID_ADDRESS, aToken);
        }

        if (_amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token);
        }

        if (!tokenRegistry.isTokenSupported(_token)) {
            revert DefiError(ERR_TOKEN_NOT_SUPPORTED, _token);
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

    function withdrawFromYieldProtocol(
        address _token,
        bool campaignSuccessful,
        uint256 coverRefunds
    ) external nonReentrant returns (uint256) {
        try aavePool.withdraw(_token, type(uint).max, address(this)) returns (
            uint256 withdrawn
        ) {
            if (campaignSuccessful) {
                (uint256 creatorShare, uint256 platformShare) = yieldDistributor
                    .calculateYieldShares(withdrawn);

                IERC20(_token).safeTransfer(msg.sender, creatorShare);
                IERC20(_token).safeTransfer(
                    yieldDistributor.platformTreasury(),
                    platformShare
                );
            } else {
                uint256 remaining = withdrawn - coverRefunds;

                IERC20(_token).safeTransfer(msg.sender, coverRefunds);
                IERC20(_token).safeTransfer(
                    yieldDistributor.platformTreasury(),
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
