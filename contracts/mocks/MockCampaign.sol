//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDefiIntegrationManager.sol";

contract MockCampaign {
    address public owner;
    address public campaignToken;
    uint256 public campaignGoalAmount;
    uint256 public campaignDuration;
    IDefiIntegrationManager public defiManager;
    uint256 public campaignEndTime;
    bool private _isCampaignActive;

    // Track all interactions with DefiIntegrationManager for testing
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalYieldHarvested;
    uint256 public lastSwapAmount;

    event FundsDeposited(address indexed token, uint256 amount);
    event FundsWithdrawn(address indexed token, uint256 amount);
    event YieldHarvested(address indexed token, uint256 amount);
    event TokensSwapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address _owner,
        address _token,
        uint256 _goal,
        uint256 _duration,
        address _defiManager
    ) {
        owner = _owner;
        campaignToken = _token;
        campaignGoalAmount = _goal;
        campaignDuration = _duration;
        defiManager = IDefiIntegrationManager(_defiManager);

        _isCampaignActive = true;
        campaignEndTime = block.timestamp + (_duration * 1 days);
    }

    function setCampaignActive(bool isActive) external {
        _isCampaignActive = isActive;
    }

    function setCampaignEndTime(uint256 endTime) external {
        campaignEndTime = endTime;
    }

    function isCampaignActive() external view returns (bool) {
        return _isCampaignActive;
    }

    function depositToYield(address token, uint256 amount) external {
        IERC20(token).approve(address(defiManager), amount);
        defiManager.depositToYieldProtocol(token, amount);
        totalDeposited += amount;

        emit FundsDeposited(token, amount);
    }

    function withdrawFromYield(address token, uint256 amount) external {
        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            token,
            amount
        );
        totalWithdrawn += withdrawn;

        emit FundsWithdrawn(token, withdrawn);
    }

    function withdrawAllFromYield(address token) external {
        uint256 withdrawn = defiManager.withdrawAllFromYieldProtocol(token);
        totalWithdrawn += withdrawn;

        emit FundsWithdrawn(token, withdrawn);
    }

    function harvestYield(address token) external {
        (uint256 creatorYield, ) = defiManager.harvestYield(token);
        totalYieldHarvested += creatorYield;

        emit YieldHarvested(token, creatorYield);
    }

    function swapTokens(
        address fromToken,
        uint256 amount,
        address toToken
    ) external {
        IERC20(fromToken).approve(address(defiManager), amount);
        uint256 received = defiManager.swapTokenForTarget(
            fromToken,
            amount,
            toToken
        );
        lastSwapAmount = received;

        emit TokensSwapped(fromToken, toToken, amount, received);
    }

    // Helper functions for testing

    function getDepositedAmount(address token) external view returns (uint256) {
        return defiManager.getDepositedAmount(address(this), token);
    }

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256) {
        return defiManager.getCurrentYieldRate(token);
    }

    // Receive funds
    receive() external payable {}
}
