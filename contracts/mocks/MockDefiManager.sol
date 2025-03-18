//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ITokenRegistry.sol";
import "../interfaces/IYieldDistributor.sol";

contract MockDefiManager {
    // Custom errors matching real implementation
    error UnauthorizedAddress();
    error ZeroAmount(uint256 amount);
    error InsufficientDeposit(
        address token,
        uint256 requested,
        uint256 available
    );
    error TokenNotSupported(address token);
    error YieldDepositFailed(string reason);
    error YieldwithdrawalFailed(string reason);
    error NoYield(address token);
    error TokensAreTheSame(address fromToken, address outToken);
    error SwapFailed(string reason);
    error NotPlatformAdmin();
    error InvalidAddress();

    // State tracking
    bool public authorizeSuccess = true;
    bool public depositSuccess = true;
    bool public withdrawSuccess = true;
    bool public harvestSuccess = true;
    bool public swapSuccess = true;

    // Access control
    address public owner;
    address public platformAdmin;

    mapping(address => bool) public authorizedCampaigns;
    mapping(address => mapping(address => uint256)) public aaveDeposits; // Campaign -> token -> amount

    // Interface contracts
    address public mockTokenRegistryAddress;
    address public mockYieldDistributorAddress;

    // Mock yield parameters
    uint256 public yieldRate = 1000; // 10% annually in basis points
    uint256 public constant UNISWAP_FEE_TIER = 3000; // 0.3%

    // Events (matching real implementation)
    event YieldDeposited(
        address indexed campaign,
        address indexed token,
        uint256 amount
    );
    event YieldWithdrawn(
        address indexed campaign,
        address indexed token,
        uint256 amount
    );
    event YieldHarvested(
        address indexed campaign,
        address indexed token,
        uint256 totalYield,
        uint256 creatorShare,
        uint256 platformShare
    );
    event TokenSwapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event CampaignAuthorized(address indexed campaign);

    constructor(
        address _tokenRegistryAddress,
        address _yieldDistributorAddress,
        address _platformAdmin,
        address _owner
    ) {
        if (
            _tokenRegistryAddress == address(0) ||
            _yieldDistributorAddress == address(0) ||
            _platformAdmin == address(0) ||
            _owner == address(0)
        ) {
            revert InvalidAddress();
        }

        mockTokenRegistryAddress = _tokenRegistryAddress;
        mockYieldDistributorAddress = _yieldDistributorAddress;
        platformAdmin = _platformAdmin;
        owner = _owner;
    }

    modifier onlyPlatformAdmin() {
        if (msg.sender != platformAdmin) {
            revert NotPlatformAdmin();
        }
        _;
    }

    // Control functions for testing
    function setAuthorizeSuccess(bool success) external {
        authorizeSuccess = success;
    }

    function setDepositSuccess(bool success) external {
        depositSuccess = success;
    }

    function setWithdrawSuccess(bool success) external {
        withdrawSuccess = success;
    }

    function setHarvestSuccess(bool success) external {
        harvestSuccess = success;
    }

    function setSwapSuccess(bool success) external {
        swapSuccess = success;
    }

    function setYieldRate(uint256 _yieldRate) external {
        yieldRate = _yieldRate;
    }

    function simulateDeposit(
        address campaign,
        address token,
        uint256 amount
    ) external {
        aaveDeposits[campaign][token] += amount;
    }

    // Interface implementation
    function authorizeCampaign(address campaign) external returns (bool) {
        if (!authorizeSuccess) {
            revert UnauthorizedAddress();
        }
        authorizedCampaigns[campaign] = true;
        emit CampaignAuthorized(campaign);
        return true;
    }

    function tokenRegistry() external view returns (ITokenRegistry) {
        return ITokenRegistry(mockTokenRegistryAddress);
    }

    function yieldDistributor() external view returns (IYieldDistributor) {
        return IYieldDistributor(mockYieldDistributorAddress);
    }

    function depositToYieldProtocol(address token, uint256 amount) external {
        if (!depositSuccess) {
            revert YieldDepositFailed("Deposit failed");
        }

        if (amount <= 0) {
            revert ZeroAmount(amount);
        }

        // Validate token via registry
        ITokenRegistry registry = ITokenRegistry(mockTokenRegistryAddress);
        if (!registry.isTokenSupported(token)) {
            revert TokenNotSupported(token);
        }

        // Transfer tokens from sender
        bool success = IERC20(token).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        if (!success) {
            revert YieldDepositFailed("Token transfer failed");
        }

        // Update deposits for the calling campaign
        aaveDeposits[msg.sender][token] += amount;

        emit YieldDeposited(msg.sender, token, amount);
    }

    function withdrawFromYieldProtocol(
        address token,
        uint256 amount
    ) external returns (uint256) {
        if (!withdrawSuccess) {
            revert YieldwithdrawalFailed("Withdrawal failed");
        }

        if (amount <= 0) {
            revert ZeroAmount(amount);
        }

        uint256 availableAmount = aaveDeposits[msg.sender][token];
        if (amount > availableAmount) {
            revert InsufficientDeposit(token, amount, availableAmount);
        }

        aaveDeposits[msg.sender][token] -= amount;
        bool success = IERC20(token).transfer(msg.sender, amount);
        if (!success) {
            revert YieldwithdrawalFailed("Token transfer failed");
        }

        emit YieldWithdrawn(msg.sender, token, amount);
        return amount;
    }

    function withdrawAllFromYieldProtocol(
        address token
    ) external returns (uint256) {
        if (!withdrawSuccess) {
            revert YieldwithdrawalFailed("Withdrawal failed");
        }

        uint256 withdrawAmount = aaveDeposits[msg.sender][token];

        if (withdrawAmount == 0) {
            revert ZeroAmount(withdrawAmount);
        }

        aaveDeposits[msg.sender][token] = 0;
        bool success = IERC20(token).transfer(msg.sender, withdrawAmount);
        if (!success) {
            revert YieldwithdrawalFailed("Token transfer failed");
        }

        emit YieldWithdrawn(msg.sender, token, withdrawAmount);

        return withdrawAmount;
    }

    function harvestYield(address token) external returns (uint256, uint256) {
        if (!harvestSuccess) {
            revert YieldwithdrawalFailed("Harvest failed");
        }

        uint256 depositAmount = aaveDeposits[msg.sender][token];
        if (depositAmount == 0) {
            revert NoYield(token);
        }

        // Calculate yield based on deposit amount and yield rate
        uint256 totalYield = (depositAmount * yieldRate) / 10000;

        if (totalYield == 0) {
            revert NoYield(token);
        }

        // Use the actual YieldDistributor logic to calculate shares
        IYieldDistributor distributor = IYieldDistributor(
            mockYieldDistributorAddress
        );
        (uint256 creatorYield, uint256 platformYield) = distributor
            .calculateYieldShares(totalYield);

        // Transfer to campaign
        bool success = IERC20(token).transfer(msg.sender, creatorYield);
        if (!success) {
            revert YieldwithdrawalFailed("Token transfer failed");
        }

        // Transfer to platform treasury
        address treasury = distributor.platformTreasury();
        success = IERC20(token).transfer(treasury, platformYield);
        if (!success) {
            revert YieldwithdrawalFailed("Token transfer to treasury failed");
        }

        emit YieldHarvested(
            msg.sender,
            token,
            totalYield,
            creatorYield,
            platformYield
        );

        return (creatorYield, platformYield);
    }

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256) {
        return yieldRate;
    }

    function getDepositedAmount(
        address campaign,
        address token
    ) external view returns (uint256) {
        return aaveDeposits[campaign][token];
    }

    function isCampaignAuthorized(
        address campaign
    ) external view returns (bool) {
        return authorizedCampaigns[campaign];
    }

    function swapTokenForTarget(
        address fromToken,
        uint256 amount,
        address toToken
    ) external returns (uint256) {
        if (!swapSuccess) {
            revert SwapFailed("Swap failed");
        }

        if (amount <= 0) {
            revert ZeroAmount(amount);
        }

        // Token validation
        ITokenRegistry registry = ITokenRegistry(mockTokenRegistryAddress);
        if (!registry.isTokenSupported(fromToken)) {
            revert TokenNotSupported(fromToken);
        }

        if (!registry.isTokenSupported(toToken)) {
            revert TokenNotSupported(toToken);
        }

        if (fromToken == toToken) {
            revert TokensAreTheSame(fromToken, toToken);
        }

        // Transfer tokens from caller
        bool success = IERC20(fromToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        if (!success) {
            revert SwapFailed("Token transfer failed");
        }

        uint256 receivedAmount = amount * 2; // 2:1 exchange rate for testing

        success = IERC20(toToken).transfer(msg.sender, receivedAmount);
        if (!success) {
            revert SwapFailed("Token transfer failed");
        }

        emit TokenSwapped(fromToken, toToken, amount, receivedAmount);

        return receivedAmount;
    }

    // Mock auxiliary functions to simulate realistic behavior
    function unauthorizeCampaign(address campaign) external {
        authorizedCampaigns[campaign] = false;
    }

    function getTokenRegistry() external view returns (ITokenRegistry) {
        return ITokenRegistry(mockTokenRegistryAddress);
    }
}
