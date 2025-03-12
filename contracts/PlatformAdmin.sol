// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IDefiIntegrationManager.sol";
import "./interfaces/Icampaign.sol";

contract PlatformAdmin is Ownable {
    uint256 public gracePeriod;
    IDefiIntegrationManager public defiManager;

    mapping(address => bool) public platformAdmins;
    mapping(address => uint256) public campaignRecoveryRequests;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event RecoveryRequested(address indexed campaign, uint256 timestamp);
    event FundsRecovered(
        address indexed campaign,
        address indexed token,
        uint256 amount
    );
    event GracePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event DefiManagerUpdated(address oldManager, address newManager);

    error NotAuthorizedAdmin();
    error InvalidAddress();
    error InvalidGracePeriod();
    error CampaignStillActive();
    error CampaignSuccessful();
    error GracePeriodNotElapsed(uint256 remainingTime);
    error NoRecoveryRequestExists();
    error RecoveryRequestAlreadyExists();
    error RecoveryFailed(string reason);
    error AdminAlreadyExists();
    error AdminDoesNotExist();

    constructor(
        address _defiManager,
        uint256 _gracePeriod,
        address _owner
    ) Ownable(_owner) {
        if (_defiManager == address(0)) revert InvalidAddress();
        if (_gracePeriod == 0) revert InvalidGracePeriod();

        defiManager = IDefiIntegrationManager(_defiManager);
        gracePeriod = _gracePeriod;

        platformAdmins[_owner] = true;
        emit AdminAdded(_owner);
    }

    modifier onlyPlatformAdmin() {
        if (!platformAdmins[msg.sender]) revert NotAuthorizedAdmin();
        _;
    }

    function addPlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (_admin == address(0)) revert InvalidAddress();
        if (platformAdmins[_admin]) revert AdminAlreadyExists();

        platformAdmins[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removePlatformAdmin(address _admin) external onlyPlatformAdmin {
        if (!platformAdmins[_admin]) revert AdminDoesNotExist();
        if (_admin == owner()) revert AdminDoesNotExist();

        platformAdmins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    function updateGracePeriod(uint256 _gracePeriod) external onlyOwner {
        if (_gracePeriod == 0) revert InvalidGracePeriod();

        uint256 oldPeriod = gracePeriod;
        gracePeriod = _gracePeriod;
        emit GracePeriodUpdated(oldPeriod, _gracePeriod);
    }

    function updateDefiManager(address _defiManager) external onlyOwner {
        if (_defiManager == address(0)) revert InvalidAddress();

        address oldManager = address(defiManager);
        defiManager = IDefiIntegrationManager(_defiManager);
        emit DefiManagerUpdated(oldManager, _defiManager);
    }

    function requestRecovery(address _campaign) external onlyPlatformAdmin {
        ICampaign campaign = ICampaign(_campaign);

        if (!defiManager.isCampaignAuthorized(_campaign))
            revert InvalidAddress();

        if (campaign.isCampaignActive()) revert CampaignStillActive();
        if (campaign.isCampaignSuccessful()) revert CampaignSuccessful();

        if (campaignRecoveryRequests[_campaign] != 0)
            revert RecoveryRequestAlreadyExists();

        campaignRecoveryRequests[_campaign] = block.timestamp;
        emit RecoveryRequested(_campaign, block.timestamp);
    }
}
