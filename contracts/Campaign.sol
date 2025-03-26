// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";
import "./interfaces/ITokenRegistry.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/CampaignLibrary.sol";
import "./libraries/TokenOperationsLibrary.sol";

contract Campaign is Ownable, ReentrancyGuard, PlatformAdminAccessControl {
    using SafeERC20 for IERC20;
    using CampaignLibrary for *;
    using TokenOperations for *;

    // Operation types for FundsOperation event
    uint8 private constant OP_DEPOSIT = 1;
    uint8 private constant OP_CLAIM_FUNDS = 2;

    // Error codes - more specific but still compact
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;
    uint8 private constant ERR_INVALID_GOAL = 3;
    uint8 private constant ERR_INVALID_DURATION = 4;
    uint8 private constant ERR_INVALID_AMOUNT = 5;
    uint8 private constant ERR_CAMPAIGN_NOT_ACTIVE = 6;
    uint8 private constant ERR_CAMPAIGN_STILL_ACTIVE = 7;
    uint8 private constant ERR_GOAL_REACHED = 8;
    uint8 private constant ERR_ETH_NOT_ACCEPTED = 9;
    uint8 private constant ERR_ALREADY_REFUNDED = 10;
    uint8 private constant ERR_NOTHING_TO_REFUND = 11;
    uint8 private constant ERR_FUNDS_CLAIMED = 12;
    uint8 private constant ERR_NOT_TARGET_TOKEN = 13;
    uint8 private constant ERR_NOTHING_TO_WITHDRAW = 14;
    uint8 private constant ERR_FUNDS_NOT_CLAIMED = 15;
    uint8 private constant ERR_ADMIN_OVERRIDE_ACTIVE = 16;
    // External contract references
    IDefiIntegrationManager public immutable defiManager;
    ITokenRegistry public immutable tokenRegistry;

    // Campaign token and identity
    address public immutable campaignToken;
    bytes32 public immutable campaignId;

    // Campaign financial parameters
    uint256 public immutable campaignGoalAmount;
    uint256 public totalAmountRaised;

    // Campaign timing parameters (packed for gas efficiency)
    uint64 public immutable campaignStartTime;
    uint64 public immutable campaignEndTime;
    uint64 public immutable campaignDuration;
    bool public hasClaimedFunds;

    uint32 public contributorsCount;

    // Contributor data
    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasBeenRefunded;
    mapping(address => bool) public isContributor;

    bool public adminOverride;

    // Events
    event Contribution(address indexed contributor, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed initiator, uint256 amount);
    event AdminOverrideSet(bool indexed status, address indexed admin);

    // Enhanced with operation details while maintaining single event definition
    event FundsOperation(
        address indexed token,
        uint256 amount,
        uint8 opType,
        address initiator
    );

    // Consolidated errors with error codes
    error CampaignError(uint8 code, address addr, uint256 value);

    constructor(
        address _owner,
        address _campaignToken,
        uint256 _campaignGoalAmount,
        uint256 _campaignDuration,
        address _defiManager,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_campaignToken == address(0))
            revert CampaignError(ERR_INVALID_ADDRESS, _campaignToken, 0);
        if (_defiManager == address(0))
            revert CampaignError(ERR_INVALID_ADDRESS, _defiManager, 0);

        if (_platformAdmin == address(0))
            revert CampaignError(ERR_INVALID_ADDRESS, _platformAdmin, 0);

        defiManager = IDefiIntegrationManager(_defiManager);
        tokenRegistry = ITokenRegistry(defiManager.tokenRegistry());

        bool isSupported;
        try tokenRegistry.isTokenSupported(_campaignToken) returns (
            bool supported
        ) {
            isSupported = supported;
        } catch {
            isSupported = false;
        }

        if (!isSupported) {
            revert CampaignError(ERR_TOKEN_NOT_SUPPORTED, _campaignToken, 0);
        }

        if (_campaignGoalAmount == 0)
            revert CampaignError(
                ERR_INVALID_GOAL,
                address(0),
                _campaignGoalAmount
            );
        if (_campaignDuration == 0)
            revert CampaignError(
                ERR_INVALID_DURATION,
                address(0),
                _campaignDuration
            );
        if (_campaignDuration > 365)
            revert CampaignError(
                ERR_INVALID_DURATION,
                address(0),
                _campaignDuration
            );

        campaignToken = _campaignToken;
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = uint64(_campaignDuration);

        campaignStartTime = uint64(block.timestamp);
        campaignEndTime = uint64(
            campaignStartTime + (_campaignDuration * 1 days)
        );

        campaignId = keccak256(
            abi.encodePacked(
                _owner,
                _campaignToken,
                _campaignGoalAmount,
                _campaignDuration,
                campaignStartTime,
                block.number
            )
        );
    }

    receive() external payable {
        revert CampaignError(ERR_ETH_NOT_ACCEPTED, address(0), 0);
    }

    function contribute(address token, uint256 amount) external nonReentrant {
        if (adminOverride)
            revert CampaignError(ERR_ADMIN_OVERRIDE_ACTIVE, token, 0);
        if (amount == 0)
            revert CampaignError(ERR_INVALID_AMOUNT, token, amount);
        if (token != campaignToken)
            revert CampaignError(ERR_NOT_TARGET_TOKEN, token, 0);
        if (!isCampaignActive())
            //Campaign end date has passed
            revert CampaignError(ERR_CAMPAIGN_NOT_ACTIVE, token, 0);

        if (totalAmountRaised >= campaignGoalAmount)
            //Campaign has already hit goal
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );

        (uint256 minAmount, ) = tokenRegistry.getMinContributionAmount(token);
        if (amount < minAmount)
            revert CampaignError(ERR_INVALID_AMOUNT, token, amount);

        if (!tokenRegistry.isTokenSupported(token))
            revert CampaignError(ERR_TOKEN_NOT_SUPPORTED, token, 0);

        // First update state variables
        if (!isContributor[msg.sender]) {
            contributorsCount++;
            isContributor[msg.sender] = true;
        }

        contributions[msg.sender] += amount;
        totalAmountRaised += amount;

        // Then handle external transfers (CEI pattern)
        TokenOperations.safeTransferFrom(
            campaignToken,
            msg.sender,
            address(this),
            amount
        );

        TokenOperations.safeIncreaseAllowance(
            token,
            address(defiManager),
            amount
        );

        defiManager.depositToYieldProtocol(token, amount);

        // Emit events last
        emit Contribution(msg.sender, amount);
        emit FundsOperation(token, amount, OP_DEPOSIT, msg.sender);
    }

    function requestRefund() external nonReentrant {
        if (isCampaignActive())
            //Campaign still accepting contributions
            revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);
        if (totalAmountRaised >= campaignGoalAmount)
            //No refunds if campaign hits goal
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );
        if (!hasClaimedFunds) {
            revert CampaignError(ERR_FUNDS_NOT_CLAIMED, address(0), 0);
        }
        if (hasBeenRefunded[msg.sender])
            revert CampaignError(ERR_ALREADY_REFUNDED, msg.sender, 0);

        uint256 refundAmount = contributions[msg.sender];
        if (refundAmount == 0)
            revert CampaignError(ERR_NOTHING_TO_REFUND, msg.sender, 0);

        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        TokenOperations.safeTransfer(campaignToken, msg.sender, refundAmount);
        emit RefundIssued(msg.sender, refundAmount);
    }

    function claimFunds() external onlyOwner nonReentrant {
        if (adminOverride)
            revert CampaignError(ERR_ADMIN_OVERRIDE_ACTIVE, address(0), 0);
        _claimFunds();
    }

    function claimFundsAdmin() external onlyPlatformAdmin nonReentrant {
        _claimFunds();
    }

    function _claimFunds() internal {
        if (!adminOverride) {
            if (isCampaignActive() && !isCampaignSuccessful())
                revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);
        }

        if (hasClaimedFunds)
            revert CampaignError(ERR_FUNDS_CLAIMED, address(0), 0);

        address aTokenAddress = defiManager.getATokenAddress(campaignToken);
        if (aTokenAddress == address(0)) {
            revert CampaignError(ERR_INVALID_ADDRESS, aTokenAddress, 0);
        }

        IERC20 aToken = IERC20(aTokenAddress);

        uint256 aTokenBalance = aToken.balanceOf(address(this));

        if (aTokenBalance == 0) {
            revert CampaignError(ERR_NOTHING_TO_WITHDRAW, address(0), 0);
        }

        aToken.safeTransfer(address(defiManager), aTokenBalance);

        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            campaignToken,
            isCampaignSuccessful(),
            totalAmountRaised
        );

        if (isCampaignSuccessful()) {
            TokenOperations.safeTransfer(
                campaignToken,
                owner(),
                IERC20(campaignToken).balanceOf(address(this))
            );
        }

        hasClaimedFunds = true;

        emit FundsOperation(
            campaignToken,
            withdrawn,
            OP_CLAIM_FUNDS,
            msg.sender
        );

        emit FundsClaimed(address(this), withdrawn);
    }

    function isCampaignActive() public view returns (bool) {
        return
            CampaignLibrary.isCampaignActive(
                block.timestamp,
                campaignStartTime,
                campaignEndTime,
                adminOverride
            );
    }

    function isCampaignSuccessful() public view returns (bool) {
        return totalAmountRaised >= campaignGoalAmount;
    }

    function isAdminOverrideActive() public view override returns (bool) {
        return adminOverride;
    }

    function setAdminOverride(bool _adminOverride) external onlyPlatformAdmin {
        adminOverride = _adminOverride;
        emit AdminOverrideSet(_adminOverride, msg.sender);
    }

    function getATokenBalance() public view returns (uint256) {
        address aTokenAddress = defiManager.getATokenAddress(campaignToken);
        if (aTokenAddress == address(0)) {
            revert CampaignError(ERR_INVALID_ADDRESS, aTokenAddress, 0);
        }
        return IERC20(aTokenAddress).balanceOf(address(this));
    }

    function getCampaignTokenBalance() public view returns (uint256) {
        return IERC20(campaignToken).balanceOf(address(this));
    }
}
