//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract YieldDistributor is Ownable {
    address public platformTreasury;
    uint16 public platformYieldShare = 2000;
    uint16 public constant maximumYieldShare = 5000;

    error InvalidAddress();
    error InvalidShare(uint256 share);
    error ShareExceedsMaximum(uint256 share);
    error Overflow();

    event PlatformTreasuryUpdated(address oldTreasury, address newTreasury);
    event PlatformYieldShareUpdated(uint256 oldShare, uint256 newShare);
    event YieldDistributed(
        address indexed campaign,
        address indexed token,
        uint256 totalYield,
        uint256 creatorShare,
        uint256 platformShare
    );

    constructor(address _platformTreasury, address _owner) Ownable(_owner) {
        if (_platformTreasury == address(0)) {
            revert InvalidAddress();
        }

        platformTreasury = _platformTreasury;
    }

    function updatePlatformTreasury(
        address _platformTreasury
    ) external onlyOwner {
        if (_platformTreasury == address(0)) {
            revert InvalidAddress();
        }

        address oldTreasury = platformTreasury;
        platformTreasury = _platformTreasury;

        emit PlatformTreasuryUpdated(oldTreasury, _platformTreasury);
    }

    function updatePlatformYieldShare(
        uint256 _platformYieldShare
    ) external onlyOwner {
        // Cast to uint16 since that's our storage type
        uint16 newShare = uint16(_platformYieldShare);

        if (newShare > maximumYieldShare) {
            revert ShareExceedsMaximum(newShare);
        }

        uint256 oldshare = platformYieldShare;
        platformYieldShare = newShare;

        emit PlatformYieldShareUpdated(oldshare, newShare);
    }

    function calculateYieldShares(
        uint256 totalYield
    ) external view returns (uint256 creatorShare, uint256 platformShare) {
        // Simplified overflow check
        if (
            totalYield > 0 &&
            platformYieldShare > 0 &&
            totalYield > type(uint256).max / platformYieldShare
        ) {
            revert Overflow();
        }

        platformShare = (totalYield * platformYieldShare) / 10000;
        // Use unchecked for this subtraction since overflow is impossible
        unchecked {
            creatorShare = totalYield - platformShare;
        }

        return (creatorShare, platformShare);
    }

    function getPlatformTreasury() external view returns (address) {
        return platformTreasury;
    }

    function getPlatformYieldShare() external view returns (uint256) {
        return platformYieldShare;
    }
}
