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
 * @dev Implements crowdfunding with contributions, refunds, fund claiming and DeFi yield via Aave
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

    // Status and operation constants (packed into single bytes)
    uint8 private constant STATUS_ACTIVE = 1;
    uint8 private constant STATUS_COMPLETE = 2;
    uint8 private constant REASON_GOAL_REACHED = 1;
    uint8 private constant REASON_DEADLINE_PASSED = 2;
    uint8 private constant OP_DEPOSIT = 1;
    uint8 private constant OP_CLAIM_FUNDS = 2;

    // Error codes
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

    // State variables - packed for gas efficiency
    IDefiIntegrationManager public immutable defiManager;
    ITokenRegistry public immutable tokenRegistry;
    address public immutable campaignToken;
    bytes32 public immutable campaignId;
    uint256 public immutable campaignGoalAmount;
    uint256 public totalAmountRaised;
    uint64 public immutable campaignStartTime;
    uint64 public immutable campaignEndTime;
    uint64 public immutable campaignDuration;
    uint32 public contributorsCount;
    uint8 public campaignStatus = STATUS_ACTIVE;
    bool public hasClaimedFunds;
    bool public adminOverride;

    // Maps (stored separately in storage)
    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasBeenRefunded;
    mapping(address => bool) public isContributor;

    // Events
    /**
     * @notice Emitted when a contribution is made to the campaign
     * @param contributor Address of the contributor
     * @param amount Amount contributed
     * @param campaignId Campaign identifier
     */
    event Contribution(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed campaignId
    );

    /**
     * @notice Emitted when a refund is issued
     * @param contributor Contributor receiving refund
     * @param amount Amount refunded
     * @param campaignId Campaign identifier
     */
    event RefundIssued(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed campaignId
    );

    /**
     * @notice Emitted when campaign funds are claimed
     * @param initiator Claimer address
     * @param amount Amount claimed
     * @param campaignId Campaign identifier
     */
    event FundsClaimed(
        address indexed initiator,
        uint256 amount,
        bytes32 indexed campaignId
    );

    /**
     * @notice Emitted when admin override status changes
     * @param status New override status
     * @param admin Admin who made the change
     * @param campaignId Campaign identifier
     */
    event AdminOverrideSet(
        bool indexed status,
        address indexed admin,
        bytes32 indexed campaignId
    );

    /**
     * @notice Emitted for token operations
     * @param token Token address
     * @param amount Amount involved
     * @param opType Operation type (1=deposit, 2=claim)
     * @param initiator Operation initiator
     * @param campaignId Campaign identifier
     */
    event FundsOperation(
        address indexed token,
        uint256 amount,
        uint8 opType,
        address initiator,
        bytes32 indexed campaignId
    );

    /**
     * @notice Emitted when campaign status changes
     * @param oldStatus Previous status
     * @param newStatus New status
     * @param reason Reason code (1=goal reached, 2=deadline passed)
     * @param campaignId Campaign identifier
     */
    event CampaignStatusChanged(
        uint8 oldStatus,
        uint8 newStatus,
        uint8 reason,
        bytes32 indexed campaignId
    );

    /**
     * @notice Campaign operation error
     * @param code Error code
     * @param addr Related address
     * @param value Related value
     * @param campaignId Campaign identifier
     */
    error CampaignError(
        uint8 code,
        address addr,
        uint256 value,
        bytes32 campaignId
    );

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
        campaignStartTime = uint64(block.timestamp);

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

        if (_defiManager == address(0))
            revert CampaignError(
                ERR_INVALID_ADDRESS,
                _defiManager,
                0,
                campaignId
            );

        if (_platformAdmin == address(0))
            revert CampaignError(
                ERR_INVALID_ADDRESS,
                _platformAdmin,
                0,
                campaignId
            );

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
                0,
                campaignId
            );
        }

        campaignToken = _campaignToken;
        campaignGoalAmount = _campaignGoalAmount;
        campaignDuration = uint64(_campaignDuration);

        campaignEndTime = uint64(
            campaignStartTime + (_campaignDuration * 1 days)
        );
    }

    /**
     * @dev Fallback function to reject ETH transfers
     */
    receive() external payable {
        revert CampaignError(ERR_ETH_NOT_ACCEPTED, address(0), 0, campaignId);
    }

    /**
     * @notice Allows a user to contribute to the campaign
     * @dev Transfers tokens from user, deposits to yield protocol, and updates state
     * @param amount Amount to contribute in campaign tokens
     */
    function contribute(uint256 amount) external nonReentrant whenNotPaused {
        checkAndUpdateStatus();

        if (adminOverride)
            revert CampaignError(
                ERR_ADMIN_OVERRIDE_ACTIVE,
                campaignToken,
                0,
                campaignId
            );
        if (amount == 0)
            revert CampaignError(
                ERR_INVALID_AMOUNT,
                campaignToken,
                amount,
                campaignId
            );

        if (!isCampaignActive())
            revert CampaignError(
                ERR_CAMPAIGN_PAST_END_DATE,
                campaignToken,
                0,
                campaignId
            );

        if (isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised,
                campaignId
            );

        (uint256 minAmount, ) = tokenRegistry.getMinContributionAmount(
            campaignToken
        );
        if (amount < minAmount)
            revert CampaignError(
                ERR_INVALID_AMOUNT,
                campaignToken,
                amount,
                campaignId
            );

        if (!isContributor[msg.sender]) {
            contributorsCount++;
            isContributor[msg.sender] = true;
        }

        bool wasSuccessfulBefore = isCampaignSuccessful();

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

        defiManager.depositToYieldProtocol(campaignToken, amount, campaignId);

        // Emit events last
        emit Contribution(msg.sender, amount, campaignId);
        emit FundsOperation(
            campaignToken,
            amount,
            OP_DEPOSIT,
            msg.sender,
            campaignId
        );

        if (
            !wasSuccessfulBefore &&
            isCampaignSuccessful() &&
            campaignStatus == STATUS_ACTIVE
        ) {
            campaignStatus = STATUS_COMPLETE;
            emit CampaignStatusChanged(
                STATUS_ACTIVE,
                STATUS_COMPLETE,
                REASON_GOAL_REACHED,
                campaignId
            );
        }
    }

    /**
     * @notice Allows a contributor to request a refund if campaign is unsuccessful
     * @dev Transfers tokens back to contributor if eligible for refund
     */
    function requestRefund() external nonReentrant whenNotPaused {
        checkAndUpdateStatus();

        if (isCampaignSuccessful())
            revert CampaignError(
                ERR_GOAL_REACHED,
                address(0),
                totalAmountRaised,
                campaignId
            );

        if (isCampaignActive())
            revert CampaignError(
                ERR_CAMPAIGN_STILL_ACTIVE,
                address(0),
                0,
                campaignId
            );

        if (!hasClaimedFunds) {
            revert CampaignError(
                ERR_FUNDS_NOT_CLAIMED,
                address(0),
                0,
                campaignId
            );
        }
        if (hasBeenRefunded[msg.sender])
            revert CampaignError(
                ERR_ALREADY_REFUNDED,
                msg.sender,
                0,
                campaignId
            );

        uint256 refundAmount = contributions[msg.sender];
        if (refundAmount == 0)
            revert CampaignError(
                ERR_NOTHING_TO_REFUND,
                msg.sender,
                0,
                campaignId
            );

        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        TokenOperations.safeTransfer(campaignToken, msg.sender, refundAmount);
        emit RefundIssued(msg.sender, refundAmount, campaignId);
    }

    /**
     * @notice Allows the campaign owner to claim funds if campaign is successful or ended
     * @dev Only callable by the owner when not in admin override mode
     */
    function claimFunds() external onlyOwner nonReentrant whenNotPaused {
        if (adminOverride)
            revert CampaignError(
                ERR_ADMIN_OVERRIDE_ACTIVE,
                address(0),
                0,
                campaignId
            );
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
        checkAndUpdateStatus();

        if (!adminOverride) {
            if (isCampaignActive() && !isCampaignSuccessful())
                revert CampaignError(
                    ERR_CAMPAIGN_STILL_ACTIVE,
                    address(0),
                    0,
                    campaignId
                );
        }

        if (hasClaimedFunds)
            revert CampaignError(ERR_FUNDS_CLAIMED, address(0), 0, campaignId);

        address aTokenAddress = defiManager.getATokenAddress(campaignToken);
        if (aTokenAddress == address(0)) {
            revert CampaignError(
                ERR_INVALID_ADDRESS,
                aTokenAddress,
                0,
                campaignId
            );
        }

        IERC20 aToken = IERC20(aTokenAddress);

        uint256 aTokenBalance = aToken.balanceOf(address(this));

        if (aTokenBalance == 0) {
            revert CampaignError(
                ERR_NOTHING_TO_WITHDRAW,
                address(0),
                0,
                campaignId
            );
        }

        hasClaimedFunds = true;

        aToken.safeTransfer(address(defiManager), aTokenBalance);

        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            campaignToken,
            isCampaignSuccessful(),
            totalAmountRaised,
            campaignId
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
            msg.sender,
            campaignId
        );

        emit FundsClaimed(address(this), withdrawn, campaignId);
    }

    /**
     * @notice Sets the admin override status
     * @dev Only callable by platform admins
     * @param _adminOverride New override status to set
     */
    function setAdminOverride(bool _adminOverride) external onlyPlatformAdmin {
        adminOverride = _adminOverride;
        emit AdminOverrideSet(_adminOverride, msg.sender, campaignId);
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

    /**
     * @notice Checks and updates the campaign status if deadline has passed
     * @dev Can be called by anyone to update campaign status to complete if deadline passed
     * @return Current campaign status after potential update
     */
    function checkAndUpdateStatus() public returns (uint8) {
        // If already complete, just return status
        if (campaignStatus == STATUS_COMPLETE) {
            return campaignStatus;
        }

        if (!isCampaignActive() && !isCampaignSuccessful()) {
            campaignStatus = STATUS_COMPLETE;
            emit CampaignStatusChanged(
                STATUS_ACTIVE,
                STATUS_COMPLETE,
                REASON_DEADLINE_PASSED,
                campaignId
            );
        }

        return campaignStatus;
    }
}
