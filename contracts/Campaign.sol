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
    uint8 private constant OP_HARVEST = 2;
    uint8 private constant OP_WITHDRAW = 3;
    uint8 private constant OP_WITHDRAW_ALL = 4;

    // Error codes - more specific but still compact
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_TOKEN_NOT_SUPPORTED = 2;
    uint8 private constant ERR_INVALID_GOAL = 3;
    uint8 private constant ERR_INVALID_DURATION = 4;
    uint8 private constant ERR_INVALID_AMOUNT = 5;
    uint8 private constant ERR_CAMPAIGN_NOT_ACTIVE = 6;
    uint8 private constant ERR_CAMPAIGN_STILL_ACTIVE = 7;
    uint8 private constant ERR_GOAL_REACHED = 8;
    uint8 private constant ERR_GOAL_NOT_REACHED = 9;
    uint8 private constant ERR_ETH_NOT_ACCEPTED = 10;
    uint8 private constant ERR_ALREADY_REFUNDED = 11;
    uint8 private constant ERR_NOTHING_TO_REFUND = 12;
    uint8 private constant ERR_FUNDS_CLAIMED = 13;
    uint8 private constant ERR_NO_YIELD = 14;
    uint8 private constant ERR_NOT_TARGET_TOKEN = 15;
    uint8 private constant ERR_YIELD_ALREADY_CLAIMED = 16;

    // External contract references
    IDefiIntegrationManager public immutable defiManager;
    ITokenRegistry public immutable tokenRegistry;

    // Campaign token and identity
    address public immutable campaignToken;
    bytes32 public immutable campaignId;

    // Campaign financial parameters
    uint256 public immutable campaignGoalAmount;
    uint256 public totalAmountRaised;
    uint256 public totalHarvestedYield;

    // Campaign timing parameters (packed for gas efficiency)
    uint64 public immutable campaignStartTime;
    uint64 public immutable campaignEndTime;
    uint64 public immutable campaignDuration;
    bool public hasClaimedYield;

    uint32 public contributorsCount;

    // Contributor data
    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasBeenRefunded;
    mapping(address => bool) public isContributor;

    bool public adminOverride;

    // Events
    event Contribution(address indexed contributor, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed owner, uint256 amount);
    event AdminOverrideSet(bool indexed status, address indexed admin);

    // Enhanced with operation details while maintaining single event definition
    event FundsOperation(
        address indexed token,
        uint256 amount,
        uint8 opType,
        uint256 yieldAmount, // Additional data for harvest operations
        address initiator // Who initiated the operation
    );

    event YieldClaimed(address indexed creator, uint256 creatorAmount);

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

        defiManager = IDefiIntegrationManager(_defiManager);
        tokenRegistry = ITokenRegistry(defiManager.tokenRegistry());

        bool isTokenValid;
        try tokenRegistry.isTokenSupported(_campaignToken) returns (
            bool supported
        ) {
            isTokenValid = supported;
        } catch {
            isTokenValid = false;
        }

        if (!isTokenValid)
            revert CampaignError(ERR_TOKEN_NOT_SUPPORTED, _campaignToken, 0);

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
        if (amount == 0)
            revert CampaignError(ERR_INVALID_AMOUNT, address(0), amount);
        if (token != campaignToken)
            revert CampaignError(ERR_NOT_TARGET_TOKEN, token, 0);
        if (!isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_NOT_ACTIVE, address(0), 0);
        if (totalAmountRaised >= campaignGoalAmount)
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );

        (uint256 minAmount, ) = tokenRegistry.getMinContributionAmount(token);
        if (amount < minAmount)
            revert CampaignError(ERR_INVALID_AMOUNT, address(0), amount);

        if (!tokenRegistry.isTokenSupported(token))
            revert CampaignError(ERR_TOKEN_NOT_SUPPORTED, token, 0);

        TokenOperations.safeTransferFrom(
            campaignToken,
            msg.sender,
            address(this),
            amount
        );

        if (!isContributor[msg.sender]) {
            contributorsCount++;
            isContributor[msg.sender] = true;
        }

        contributions[msg.sender] += amount;
        totalAmountRaised += amount;

        emit Contribution(msg.sender, amount);
    }

    function requestRefund() external nonReentrant {
        if (isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);
        if (totalAmountRaised >= campaignGoalAmount)
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );
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

    function depositToYieldProtocol(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (!isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_NOT_ACTIVE, address(0), 0);

        TokenOperations.safeIncreaseAllowance(
            token,
            address(defiManager),
            amount
        );
        defiManager.depositToYieldProtocol(token, amount);

        emit FundsOperation(token, amount, OP_DEPOSIT, 0, msg.sender);
    }

    function harvestYield(address token) external onlyOwner nonReentrant {
        _harvestYield(token, msg.sender);
    }

    function harvestYieldAdmin(
        address token
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        _harvestYield(token, msg.sender);
    }

    function _harvestYield(address token, address initiator) internal {
        (uint256 _contributorYield, ) = defiManager.harvestYield(token);
        totalHarvestedYield += _contributorYield;

        emit FundsOperation(token, 0, OP_HARVEST, _contributorYield, initiator);
    }

    function withdrawAllFromYieldProtocol(
        address token
    ) external onlyOwner nonReentrant {
        _withdrawAllFromYield(token, msg.sender);
    }

    function withdrawAllFromYieldProtocolAdmin(
        address token
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        _withdrawAllFromYield(token, msg.sender);
    }

    function _withdrawAllFromYield(address token, address initiator) internal {
        uint256 withdrawn = defiManager.withdrawAllFromYieldProtocol(token);

        emit FundsOperation(token, withdrawn, OP_WITHDRAW_ALL, 0, initiator);
    }

    function withdrawFromYieldProtocol(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        _withdrawFromYield(token, amount, msg.sender);
    }

    function withdrawFromYieldProtocolAdmin(
        address token,
        uint256 amount
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        _withdrawFromYield(token, amount, msg.sender);
    }

    function _withdrawFromYield(
        address token,
        uint256 amount,
        address initiator
    ) internal {
        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            token,
            amount
        );
        emit FundsOperation(token, withdrawn, OP_WITHDRAW, 0, initiator);
    }

    function claimYield() external onlyOwner nonReentrant {
        if (isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);
        if (!isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_NOT_REACHED,
                address(0),
                totalAmountRaised
            );
        if (hasClaimedYield)
            revert CampaignError(ERR_YIELD_ALREADY_CLAIMED, msg.sender, 0);

        if (totalHarvestedYield == 0)
            revert CampaignError(ERR_NO_YIELD, address(0), 0);

        hasClaimedYield = true;

        TokenOperations.safeTransfer(
            campaignToken,
            owner(),
            totalHarvestedYield
        );

        emit YieldClaimed(owner(), totalHarvestedYield);
    }

    function claimYieldAdmin()
        external
        onlyPlatformAdminAfterGrace
        nonReentrant
    {
        if (isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);
        if (!isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_NOT_REACHED,
                address(0),
                totalAmountRaised
            );
        if (hasClaimedYield)
            revert CampaignError(ERR_YIELD_ALREADY_CLAIMED, msg.sender, 0);

        if (totalHarvestedYield == 0)
            revert CampaignError(ERR_NO_YIELD, address(0), 0);

        hasClaimedYield = true;

        address platformTreasury = defiManager
            .yieldDistributor()
            .platformTreasury();

        TokenOperations.safeTransfer(
            campaignToken,
            platformTreasury,
            totalHarvestedYield
        );
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

    function getDepositedAmount(address token) external view returns (uint256) {
        return defiManager.getDepositedAmount(address(this), token);
    }

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256) {
        return defiManager.getCurrentYieldRate(token);
    }

    function setAdminOverride(bool _adminOverride) external onlyPlatformAdmin {
        adminOverride = _adminOverride;
        emit AdminOverrideSet(_adminOverride, msg.sender);
    }
}
