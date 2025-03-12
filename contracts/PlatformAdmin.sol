// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/Icampaign.sol";

contract PlatformAdmin is Ownable, ReentrancyGuard {
    uint256 public gracePeriod;

    mapping(address => bool) public platformAdmins;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event GracePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    error NotAuthorizedAdmin();
    error InvalidAddress();
    error InvalidGracePeriod();
    error AdminDoesNotExist();
    error AdminAlreadyExists();

    constructor(uint256 _gracePeriod, address _owner) Ownable(_owner) {
        if (_gracePeriod == 0) revert InvalidGracePeriod();

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

    function isGracePeriodOver(address _campaign) external view returns (bool) {
        ICampaign campaign = ICampaign(_campaign);

        if (campaign.isCampaignActive()) {
            return false;
        } else {
            return true;
        }
    }
}
