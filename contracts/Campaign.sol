// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

contract Campaign is Ownable, ReentrancyGuard, PlatformAdminAccessControl {
    using SafeERC20 for IERC20;

    IDefiIntegrationManager public immutable defiManager;

    address public campaignToken;

    bytes32 public campaignId;
    uint256 public campaignGoalAmount;
    uint256 public totalAmountRaised;
    uint256 public totalHarvestedYield;

    uint64 public campaignStartTime;
    uint64 public campaignEndTime;
    uint64 public campaignDuration;
    bool public isClaimed;

    address[] public contributors;

    mapping(address => uint256) public contributions;
    mapping(address => uint256) public contributionTimestamps;

    mapping(address => bool) public hasBeenRefunded;
    mapping(address => bool) public hasClaimedYield;
    mapping(address => bool) public isContributor;

    uint256 public totalWeightedContributions;
    mapping(address => uint256) public weightedContributions;
    bool public weightedContributionsCalculated;

    event Contribution(address indexed contributor, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed owner, uint256 amount);
    event FundsDeposited(address indexed token, uint256 amount);
    event YieldHarvested(address indexed token, uint256 creatorYield);
    event WithdrawnFromYield(address indexed token, uint256 amount);
    event TokensSwapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event YieldDistributed(address indexed contributor, uint256 amount);
    event YieldSharesCalculated();

    error InvalidAddress();
    error ContributionTokenNotSupported(address token);
    error InvalidGoalAmount(uint256 amount);
    error InvalidCampaignDuration(uint256 duration);
    error InvalidContributionAmount(uint256 amount);
    error CampaignNotActive();
    error CampaignStillActive();
    error CampaignGoalReached();
    error CampaignGoalNotReached();
    error ETHNotAccepted();
    error AlreadyRefunded();
    error NothingToRefund(address user);
    error RefundFailed();
    error FundsAlreadyClaimed();
    error ClaimTransferFailed();
    error InvalidSwapAmount(uint256);
    error NoHarvestedYield();
    error NoYieldToClaim();
    error YieldAlreadyClaimed();
    error YieldShareAlreadyCalculated();
    error WeightedContributionsNotCalculated();

    constructor(
        address _owner,
        address _campaignToken,
        uint256 _campaignGoalAmount,
        uint256 _campaignDuration,
        address _defiManager,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {
        if (_campaignToken == address(0)) revert InvalidAddress();
        if (_defiManager == address(0)) revert InvalidAddress();

        defiManager = IDefiIntegrationManager(_defiManager);

        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();

        if (!tokenRegistry.isTokenSupported(_campaignToken)) {
            revert ContributionTokenNotSupported(_campaignToken);
        }

        if (_campaignGoalAmount == 0)
            revert InvalidGoalAmount(_campaignGoalAmount);
        if (_campaignDuration == 0)
            revert InvalidCampaignDuration(_campaignDuration);

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
        revert ETHNotAccepted();
    }

    function contribute(
        address fromToken,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert InvalidContributionAmount(amount);
        if (!isCampaignActive()) revert CampaignNotActive();
        if (totalAmountRaised >= campaignGoalAmount)
            revert CampaignGoalReached();

        ITokenRegistry tokenRegistry = defiManager.tokenRegistry();
        if (!tokenRegistry.isTokenSupported(fromToken)) {
            revert ContributionTokenNotSupported(fromToken);
        }

        uint256 contributionAmount;

        if (fromToken == campaignToken) {
            contributionAmount = amount;
            contributions[msg.sender] += contributionAmount;
            totalAmountRaised += contributionAmount;

            IERC20(campaignToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        } else {
            IERC20(fromToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
            IERC20(fromToken).safeIncreaseAllowance(
                address(defiManager),
                amount
            );

            uint256 received = defiManager.swapTokenForTarget(
                fromToken,
                amount,
                campaignToken
            );
            contributionAmount = received;

            contributions[msg.sender] += contributionAmount;
            totalAmountRaised += contributionAmount;

            emit TokensSwapped(fromToken, campaignToken, amount, received);
        }

        contributionTimestamps[msg.sender] = block.timestamp;

        if (!isContributor[msg.sender]) {
            isContributor[msg.sender] = true;
            contributors.push(msg.sender);
        }

        emit Contribution(msg.sender, contributionAmount);
    }

    function requestRefund() external nonReentrant {
        if (isCampaignActive()) revert CampaignStillActive();
        if (totalAmountRaised >= campaignGoalAmount)
            revert CampaignGoalReached();

        if (hasBeenRefunded[msg.sender]) revert AlreadyRefunded();

        uint256 refundAmount = contributions[msg.sender];
        if (refundAmount == 0) revert NothingToRefund(msg.sender);

        hasBeenRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        IERC20(campaignToken).safeTransfer(msg.sender, refundAmount);

        emit RefundIssued(msg.sender, refundAmount);
    }

    function claimFunds() external onlyOwner nonReentrant {
        if (isCampaignActive()) revert CampaignStillActive();
        if (totalAmountRaised < campaignGoalAmount)
            revert CampaignGoalNotReached();
        if (isClaimed) revert FundsAlreadyClaimed();

        uint256 balance = IERC20(campaignToken).balanceOf(address(this));
        isClaimed = true;

        IERC20(campaignToken).safeTransfer(owner(), balance);

        emit FundsClaimed(owner(), balance);
    }

    function depositToYieldProtocol(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (!isCampaignActive()) revert CampaignNotActive();

        IERC20(token).safeIncreaseAllowance(address(defiManager), amount);

        defiManager.depositToYieldProtocol(token, amount);
        emit FundsDeposited(token, amount);
    }

    function harvestYield(address token) external onlyOwner nonReentrant {
        (uint256 _contributorYield, ) = defiManager.harvestYield(token);
        totalHarvestedYield += _contributorYield;
        emit YieldHarvested(token, _contributorYield);
    }

    function harvestYieldAdmin(
        address token
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        (uint256 _contributorYield, ) = defiManager.harvestYield(token);
        totalHarvestedYield += _contributorYield;
        emit YieldHarvested(token, _contributorYield);
    }

    function withdrawAllFromYieldProtocol(
        address token
    ) external onlyOwner nonReentrant {
        uint256 withdrawn = defiManager.withdrawAllFromYieldProtocol(token);
        emit WithdrawnFromYield(token, withdrawn);
    }

    function withdrawAllFromYieldProtocolAdmin(
        address token
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        uint256 withdrawn = defiManager.withdrawAllFromYieldProtocol(token);
        emit WithdrawnFromYield(token, withdrawn);
    }

    function withdrawFromYieldProtocol(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            token,
            amount
        );
        emit WithdrawnFromYield(token, withdrawn);
    }

    function withdrawFromYieldProtocolAdmin(
        address token,
        uint256 amount
    ) external onlyPlatformAdminAfterGrace nonReentrant {
        uint256 withdrawn = defiManager.withdrawFromYieldProtocol(
            token,
            amount
        );
        emit WithdrawnFromYield(token, withdrawn);
    }

    //Claiming yield
    function calculateTimeWeight(
        address contributor
    ) internal view returns (uint256) {
        if (isCampaignActive()) revert CampaignStillActive();

        if (!isContributor[contributor] || contributions[contributor] == 0) {
            return 0;
        }

        uint256 contributionTime = contributionTimestamps[contributor];
        if (contributionTime == 0) return 0;

        uint256 campaignDurationSoFar = contributionTime - campaignStartTime;
        uint256 totalDuration = campaignEndTime - campaignStartTime;

        uint256 percentageThrough = (campaignDurationSoFar * 100) /
            totalDuration;

        if (percentageThrough < 25) {
            return 150; // 1.5x weight (scaled by 100)
        } else if (percentageThrough < 50) {
            return 125; // 1.25x weight
        } else if (percentageThrough < 75) {
            return 110; // 1.1x weight
        } else {
            return 100; // 1.0x weight (no bonus)
        }
    }

    function calculateWeightedContributions() public {
        if (isCampaignActive()) revert CampaignStillActive();
        if (weightedContributionsCalculated)
            revert YieldShareAlreadyCalculated();

        totalWeightedContributions = 0;

        for (uint256 i = 0; i < contributors.length; i++) {
            address contributor = contributors[i];
            if (contributions[contributor] == 0) continue;

            uint256 timeWeight = calculateTimeWeight(contributor);
            uint256 weighted = (contributions[contributor] * timeWeight) / 100;

            weightedContributions[contributor] = weighted;
            totalWeightedContributions += weighted;
        }

        weightedContributionsCalculated = true;

        emit YieldSharesCalculated();
    }

    function calculateYieldShare() public view returns (uint256) {
        if (!weightedContributionsCalculated) {
            revert WeightedContributionsNotCalculated();
        }

        if (weightedContributions[msg.sender] == 0) return 0;

        return
            (totalHarvestedYield * weightedContributions[msg.sender]) /
            totalWeightedContributions;
    }

    function claimYield() external nonReentrant {
        if (isCampaignActive()) revert CampaignStillActive();

        if (!weightedContributionsCalculated)
            revert WeightedContributionsNotCalculated();
        if (!isContributor[msg.sender] || contributions[msg.sender] == 0) {
            revert NoYieldToClaim();
        }

        if (hasClaimedYield[msg.sender]) {
            revert YieldAlreadyClaimed();
        }

        if (totalHarvestedYield == 0) {
            revert NoHarvestedYield();
        }

        uint256 yieldShare = calculateYieldShare();
        if (yieldShare == 0) {
            revert NoYieldToClaim();
        }

        hasClaimedYield[msg.sender] = true;

        IERC20(campaignToken).safeTransfer(msg.sender, yieldShare);

        emit YieldDistributed(msg.sender, yieldShare);
    }

    function isCampaignActive() public view returns (bool) {
        return (block.timestamp >= campaignStartTime &&
            block.timestamp < campaignEndTime);
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

    function getContributorsCount() external view returns (uint256) {
        return contributors.length;
    }
}
