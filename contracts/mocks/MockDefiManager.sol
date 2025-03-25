//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ITokenRegistry.sol";
import "../interfaces/IYieldDistributor.sol";
import "../interfaces/IAavePool.sol";
import "../abstracts/PlatformAdminAccessControl.sol";

contract MockDefiManager is
    Ownable,
    ReentrancyGuard,
    PlatformAdminAccessControl
{
    using SafeERC20 for IERC20;

    // Operation types for events (matching real implementation)
    uint8 private constant OP_DEPOSITED = 1;
    uint8 private constant OP_WITHDRAWN = 2;
    uint8 private constant OP_CONFIG_UPDATED = 3;

    // Error codes (matching real implementation)
    uint8 private constant ERR_ZERO_AMOUNT = 1;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;
    uint8 private constant ERR_DEPOSIT_FAILED = 3;
    uint8 private constant ERR_WITHDRAWAL_FAILED = 4;
    uint8 private constant ERR_INVALID_ADDRESS = 5;
    uint8 private constant ERR_INVALID_CONSTRUCTOR = 6;
    uint8 private constant ERR_WITHDRAWAL_DOESNT_BALANCE = 7;

    // External contracts
    IAavePool public aavePool;
    ITokenRegistry public tokenRegistry;
    IYieldDistributor public yieldDistributor;

    // State tracking
    mapping(address => mapping(address => uint256)) public aaveBalances;
    mapping(address => address) public mockATokenAddresses;

    // Mock control variables
    bool public depositSuccess = true;
    bool public withdrawSuccess = true;
    bool public withdrawalBalanceCheck = true;

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

    // Mock control functions
    function setDepositSuccess(bool success) external {
        depositSuccess = success;
    }

    function setWithdrawSuccess(bool success) external {
        withdrawSuccess = success;
    }

    function setWithdrawalBalanceCheck(bool check) external {
        withdrawalBalanceCheck = check;
    }

    function setMockATokenAddress(address token, address aToken) external {
        mockATokenAddresses[token] = aToken;
    }

    // Interface implementation matching real DefiIntegrationManager
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
        if (!depositSuccess) {
            revert DefiError(ERR_DEPOSIT_FAILED, _token);
        }

        if (_amount <= 0) {
            revert DefiError(ERR_ZERO_AMOUNT, _token);
        }

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

        // Transfer tokens from sender (matching real implementation)
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // Mock the supply to Aave
        aaveBalances[_token][msg.sender] += _amount;

        emit DefiOperation(
            OP_DEPOSITED,
            msg.sender,
            _token,
            address(0),
            _amount,
            0
        );
    }

    function withdrawFromYieldProtocol(
        address _token,
        bool campaignSuccessful,
        uint256 coverRefunds
    ) external nonReentrant returns (uint256) {
        if (!withdrawSuccess) {
            revert DefiError(ERR_WITHDRAWAL_FAILED, _token);
        }

        address aTokenAddress = getATokenAddress(_token);
        uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
        uint256 withdrawn = aTokenBalance; // Default to match

        // Simulate the withdrawal balance check
        if (!withdrawalBalanceCheck) {
            withdrawn = aTokenBalance / 2; // Simulate mismatch
            revert DefiError(ERR_WITHDRAWAL_DOESNT_BALANCE, _token);
        }

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
    }

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256) {
        // Mock implementation
        return 500; // 5% in basis points
    }

    function getPlatformTreasury() external view returns (address) {
        return yieldDistributor.platformTreasury();
    }

    function getATokenAddress(address _token) public view returns (address) {
        // Check if we have a mock aToken address set
        if (mockATokenAddresses[_token] != address(0)) {
            return mockATokenAddresses[_token];
        }

        // Default mock implementation
        return
            address(
                uint160(uint256(keccak256(abi.encodePacked("aToken", _token))))
            );
    }

    // Helper function for testing
    function simulateATokenBalance(address _token, uint256 _balance) external {
        address aTokenAddress = getATokenAddress(_token);
        // This would require the test to deploy a mock aToken as well
        // or to use a mocking framework to intercept the balanceOf call
    }
}
