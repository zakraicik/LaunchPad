//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITokenRegistry.sol";

interface IDefiIntegrationManager {
    function authorizeCampaign(address _campaign) external;

    function depositToYieldProtocol(address _token, uint256 _amount) external;

    function withdrawFromYieldProtocol(
        address _token,
        uint256 _amount
    ) external returns (uint256);

    function withdrawAllFromYieldProtocol(
        address _token
    ) external returns (uint256);

    function harvestYield(
        address _token
    ) external returns (uint256 creatorYield, uint256 platformYield);

    function swapTokenForTarget(
        address _fromToken,
        uint256 _amount,
        address _toToken
    ) external returns (uint256);

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate);

    function getDepositedAmount(
        address campaign,
        address token
    ) external view returns (uint256 amount);

    function tokenRegistry() external view returns (ITokenRegistry);

    function setPlatformAdmin(address _platformAdmin) external;

    function isPlatformAdmin(address _address) external view returns (bool);

    function isCampaignAuthorized(
        address campaign
    ) external view returns (bool isAuthorized);

    function adminWithdrawFromYieldProtocol(
        address _campaign,
        address _token,
        uint256 _amount
    ) external returns (uint256);
}
