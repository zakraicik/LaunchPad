// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";
import "./interfaces/ITokenRegistry.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./abstracts/PausableControl.sol";
import "./libraries/CampaignLibrary.sol";
import "./libraries/TokenOperationsLibrary.sol";
import "./libraries/FactoryLibrary.sol";

contract Campaign is
    Ownable,
    ReentrancyGuard,
    PlatformAdminAccessControl,
    PausableControl
{
    using SafeERC20 for IERC20;
    using CampaignLibrary for *;
    using TokenOperations for *;
    using FactoryLibrary for *;

    // Operation types for FundsOperation event
    uint8 private constant OP_DEPOSIT = 1;
    uint8 private constant OP_CLAIM_FUNDS = 2;

    // Error codes - more specific but still compact
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_INVALID_AMOUNT = 2;
    uint8 private constant ERR_ETH_NOT_ACCEPTED = 3;
    uint8 private constant ERR_CAMPAIGN_STILL_ACTIVE = 4;
    uint8 private constant ERR_CAMPAIGN_PAST_END_DATE = 5;
    uint8 private constant ERR_GOAL_REACHED = 6;
    uint8 private constant ERR_ADMIN_OVERRIDE_ACTIVE = 7;
    uint8 private constant ERR_FUNDS_CLAIMED = 8;
    uint8 private constant ERR_FUNDS_NOT_CLAIMED = 9;
    uint8 private constant ERR_NOTHING_TO_WITHDRAW = 10;
    uint8 private constant ERR_ALREADY_REFUNDED = 11;
    uint8 private constant ERR_NOTHING_TO_REFUND = 12;
    uint8 private constant ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 13;
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
        uint32 _campaignDuration,
        address _defiManager,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_defiManager == address(0))
            revert CampaignError(ERR_INVALID_ADDRESS, _defiManager, 0);

        if (_platformAdmin == address(0))
            revert CampaignError(ERR_INVALID_ADDRESS, _platformAdmin, 0);

        defiManager = IDefiIntegrationManager(_defiManager);
        tokenRegistry = ITokenRegistry(defiManager.tokenRegistry());

        function(address)
            external
            view
            returns (bool) isTokenSupported = tokenRegistry.isTokenSupported;

        bool isValid = FactoryLibrary.validateCampaignParams(
            _campaignToken,
            _campaignGoalAmount,
            _campaignDuration,
            isTokenSupported
        );

        if (!isValid) {
            revert CampaignError(
                ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
                address(0),
                0
            );
        }

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

    function contribute(uint256 amount) external nonReentrant whenNotPaused {
        if (adminOverride)
            revert CampaignError(ERR_ADMIN_OVERRIDE_ACTIVE, campaignToken, 0);
        if (amount == 0)
            revert CampaignError(ERR_INVALID_AMOUNT, campaignToken, amount);

        if (!isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_PAST_END_DATE, campaignToken, 0);

        if (isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );

        (uint256 minAmount, ) = tokenRegistry.getMinContributionAmount(
            campaignToken
        );
        if (amount < minAmount)
            revert CampaignError(ERR_INVALID_AMOUNT, campaignToken, amount);

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
            campaignToken,
            address(defiManager),
            amount
        );

        defiManager.depositToYieldProtocol(campaignToken, amount);

        // Emit events last
        emit Contribution(msg.sender, amount);
        emit FundsOperation(campaignToken, amount, OP_DEPOSIT, msg.sender);
    }

    function requestRefund() external nonReentrant whenNotPaused {
        if (isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised
            );

        if (isCampaignActive())
            revert CampaignError(ERR_CAMPAIGN_STILL_ACTIVE, address(0), 0);

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

    function claimFunds() external onlyOwner nonReentrant whenNotPaused {
        if (adminOverride)
            revert CampaignError(ERR_ADMIN_OVERRIDE_ACTIVE, address(0), 0);
        _claimFunds();
    }

    function claimFundsAdmin()
        external
        onlyPlatformAdmin
        nonReentrant
        whenNotPaused
    {
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

        hasClaimedFunds = true;

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

        emit FundsOperation(
            campaignToken,
            withdrawn,
            OP_CLAIM_FUNDS,
            msg.sender
        );

        emit FundsClaimed(address(this), withdrawn);
    }

    function setAdminOverride(bool _adminOverride) external onlyPlatformAdmin {
        adminOverride = _adminOverride;
        emit AdminOverrideSet(_adminOverride, msg.sender);
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
        return
            CampaignLibrary.isCampaignSuccessful(
                totalAmountRaised,
                campaignGoalAmount
            );
    }

    function isAdminOverrideActive() public view override returns (bool) {
        return adminOverride;
    }

    function getCampaignTokenBalance() public view returns (uint256) {
        return IERC20(campaignToken).balanceOf(address(this));
    }
}
