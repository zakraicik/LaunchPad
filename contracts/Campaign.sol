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

/**
 * @title Campaign
 * @author Generated with assistance from an LLM
 * @notice Smart contract for managing crowdfunding campaigns with DeFi yield generation
 * @dev Implements core crowdfunding functionality including contributions, refunds, and fund claiming
 * with integrated DeFi yield generation through Aave
 */
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
    /**
     * @dev Constant defining deposit operation type for events
     */
    uint8 private constant OP_DEPOSIT = 1;

    /**
     * @dev Constant defining claim funds operation type for events
     */
    uint8 private constant OP_CLAIM_FUNDS = 2;

    // Error codes - more specific but still compact
    /**
     * @dev Error code for invalid address
     */
    uint8 private constant ERR_INVALID_ADDRESS = 1;

    /**
     * @dev Error code for invalid amount
     */
    uint8 private constant ERR_INVALID_AMOUNT = 2;

    /**
     * @dev Error code for ETH not being accepted
     */
    uint8 private constant ERR_ETH_NOT_ACCEPTED = 3;

    /**
     * @dev Error code for campaign still being active
     */
    uint8 private constant ERR_CAMPAIGN_STILL_ACTIVE = 4;

    /**
     * @dev Error code for campaign being past end date
     */
    uint8 private constant ERR_CAMPAIGN_PAST_END_DATE = 5;

    /**
     * @dev Error code for campaign goal already reached
     */
    uint8 private constant ERR_GOAL_REACHED = 6;

    /**
     * @dev Error code for admin override being active
     */
    uint8 private constant ERR_ADMIN_OVERRIDE_ACTIVE = 7;

    /**
     * @dev Error code for funds already claimed
     */
    uint8 private constant ERR_FUNDS_CLAIMED = 8;

    /**
     * @dev Error code for funds not yet claimed
     */
    uint8 private constant ERR_FUNDS_NOT_CLAIMED = 9;

    /**
     * @dev Error code for nothing available to withdraw
     */
    uint8 private constant ERR_NOTHING_TO_WITHDRAW = 10;

    /**
     * @dev Error code for contributor already refunded
     */
    uint8 private constant ERR_ALREADY_REFUNDED = 11;

    /**
     * @dev Error code for nothing available to refund
     */
    uint8 private constant ERR_NOTHING_TO_REFUND = 12;

    /**
     * @dev Error code for campaign constructor validation failure
     */
    uint8 private constant ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 13;

    /**
     * @notice Reference to the DeFi integration manager for yield generation
     * @dev Immutable reference to the DeFi integration manager contract
     */
    IDefiIntegrationManager public immutable defiManager;

    /**
     * @notice Reference to the token registry for token validation
     * @dev Immutable reference to the token registry contract
     */
    ITokenRegistry public immutable tokenRegistry;

    /**
     * @notice Address of the token used for this campaign
     * @dev Immutable address of the campaign's contribution token
     */
    address public immutable campaignToken;

    /**
     * @notice Unique identifier for this campaign
     * @dev Immutable hash generated from campaign parameters at creation
     */
    bytes32 public immutable campaignId;

    /**
     * @notice The target funding goal for this campaign
     * @dev Immutable goal amount in campaign tokens
     */
    uint256 public immutable campaignGoalAmount;

    /**
     * @notice Total amount raised by the campaign so far
     * @dev Running total of contributions in campaign tokens
     */
    uint256 public totalAmountRaised;

    /**
     * @notice Timestamp when the campaign started
     * @dev Immutable start time set at contract creation
     */
    uint64 public immutable campaignStartTime;

    /**
     * @notice Timestamp when the campaign will end
     * @dev Immutable end time calculated from start time and duration
     */
    uint64 public immutable campaignEndTime;

    /**
     * @notice Duration of the campaign in days
     * @dev Immutable duration set at contract creation
     */
    uint64 public immutable campaignDuration;

    /**
     * @notice Flag indicating if funds have been claimed
     * @dev Set to true once funds are successfully claimed
     */
    bool public hasClaimedFunds;

    /**
     * @notice Count of unique contributors to the campaign
     * @dev Incremented when a new contributor makes their first contribution
     */
    uint32 public contributorsCount;

    /**
     * @notice Maps contributor addresses to their contribution amounts
     * @dev Records total contribution amount per contributor
     */
    mapping(address => uint256) public contributions;

    /**
     * @notice Maps contributor addresses to their refund status
     * @dev True if contributor has been refunded, false otherwise
     */
    mapping(address => bool) public hasBeenRefunded;

    /**
     * @notice Maps addresses to their contributor status
     * @dev True if address has contributed to the campaign, false otherwise
     */
    mapping(address => bool) public isContributor;

    /**
     * @notice Flag for administrative override of campaign status
     * @dev When true, allows admins to bypass normal campaign flow restrictions
     */
    bool public adminOverride;

    /**
     * @notice Emitted when a contribution is made to the campaign
     * @param contributor Address of the contributor
     * @param amount Amount contributed
     */
    event Contribution(address indexed contributor, uint256 amount);

    /**
     * @notice Emitted when a refund is issued to a contributor
     * @param contributor Address of the contributor receiving refund
     * @param amount Amount refunded
     */
    event RefundIssued(address indexed contributor, uint256 amount);

    /**
     * @notice Emitted when campaign funds are claimed
     * @param initiator Address that initiated the funds claim
     * @param amount Amount of funds claimed
     */
    event FundsClaimed(address indexed initiator, uint256 amount);

    /**
     * @notice Emitted when admin override status is changed
     * @param status New override status
     * @param admin Address of admin who made the change
     */
    event AdminOverrideSet(bool indexed status, address indexed admin);

    /**
     * @notice Emitted for fund operations with details
     * @param token Address of the token involved
     * @param amount Amount of tokens involved
     * @param opType Type of operation (1 = deposit, 2 = claim funds)
     * @param initiator Address that initiated the operation
     */
    event FundsOperation(
        address indexed token,
        uint256 amount,
        uint8 opType,
        address initiator
    );

    /**
     * @notice Thrown when a campaign operation fails
     * @param code Error code identifying the failure reason
     * @param addr Related address (if applicable)
     * @param value Related value (if applicable)
     */
    error CampaignError(uint8 code, address addr, uint256 value);

    /**
     * @notice Creates a new campaign
     * @dev Sets up the campaign with specified parameters and validates inputs
     * @param _owner Address of the campaign owner who can claim funds
     * @param _campaignToken Address of the token used for contributions
     * @param _campaignGoalAmount Target funding goal amount
     * @param _campaignDuration Duration of the campaign in days
     * @param _defiManager Address of the DeFi integration manager
     * @param _platformAdmin Address of the platform admin contract
     */
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

    /**
     * @dev Fallback function to reject ETH transfers
     */
    receive() external payable {
        revert CampaignError(ERR_ETH_NOT_ACCEPTED, address(0), 0);
    }

    /**
     * @notice Allows a user to contribute to the campaign
     * @dev Transfers tokens from user, deposits to yield protocol, and updates state
     * @param amount Amount to contribute in campaign tokens
     */
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

    /**
     * @notice Allows a contributor to request a refund if campaign is unsuccessful
     * @dev Transfers tokens back to contributor if eligible for refund
     */
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

    /**
     * @notice Allows the campaign owner to claim funds if campaign is successful or ended
     * @dev Only callable by the owner when not in admin override mode
     */
    function claimFunds() external onlyOwner nonReentrant whenNotPaused {
        if (adminOverride)
            revert CampaignError(ERR_ADMIN_OVERRIDE_ACTIVE, address(0), 0);
        _claimFunds();
    }

    /**
     * @notice Allows platform admins to claim funds on behalf of the campaign
     * @dev Only callable by platform admins, can bypass some restrictions
     */
    function claimFundsAdmin()
        external
        onlyPlatformAdmin
        nonReentrant
        whenNotPaused
    {
        _claimFunds();
    }

    /**
     * @notice Internal implementation of fund claiming logic
     * @dev Withdraws funds from yield protocol and handles distribution based on campaign success
     */
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

    /**
     * @notice Sets the admin override status
     * @dev Only callable by platform admins
     * @param _adminOverride New override status to set
     */
    function setAdminOverride(bool _adminOverride) external onlyPlatformAdmin {
        adminOverride = _adminOverride;
        emit AdminOverrideSet(_adminOverride, msg.sender);
    }

    /**
     * @notice Checks if the campaign is currently active
     * @dev A campaign is active if current time is between start and end times and no admin override
     * @return True if campaign is active, false otherwise
     */
    function isCampaignActive() public view returns (bool) {
        return
            CampaignLibrary.isCampaignActive(
                block.timestamp,
                campaignStartTime,
                campaignEndTime,
                adminOverride
            );
    }

    /**
     * @notice Checks if the campaign has successfully reached its funding goal
     * @dev A campaign is successful if total raised equals or exceeds goal amount
     * @return True if campaign is successful, false otherwise
     */
    function isCampaignSuccessful() public view returns (bool) {
        return
            CampaignLibrary.isCampaignSuccessful(
                totalAmountRaised,
                campaignGoalAmount
            );
    }

    /**
     * @notice Checks if admin override is currently active
     * @dev Implementation of abstract function from PlatformAdminAccessControl
     * @return True if admin override is active, false otherwise
     */
    function isAdminOverrideActive() public view override returns (bool) {
        return adminOverride;
    }

    /**
     * @notice Returns the current balance of campaign tokens held by the contract
     * @dev Direct query of token balance not accounting for tokens in yield protocol
     * @return Current balance of campaign tokens
     */
    function getCampaignTokenBalance() public view returns (uint256) {
        return IERC20(campaignToken).balanceOf(address(this));
    }
}
