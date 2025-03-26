//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITokenRegistry.sol";
import "./IFeeManager.sol";
import "./IAavePool.sol";

interface IDefiIntegrationManager {
    function depositToYieldProtocol(address _token, uint256 _amount) external;

    function withdrawFromYieldProtocol(
        address _token,
        bool _campaignSuccessful,
        uint256 _coverRefunds
    ) external returns (uint256);

    function setTokenRegistry(address _tokenRegistry) external;

    function setFeeManager(address _feeManager) external;

    function setAavePool(address _aavePool) external;

    function tokenRegistry() external view returns (ITokenRegistry);

    function feeManager() external view returns (IFeeManager);

    function aavePool() external view returns (IAavePool);

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate);

    function getPlatformTreasury() external view returns (address);

    function getATokenAddress(address _token) external view returns (address);

    function aaveBalances(
        address _token,
        address _user
    ) external view returns (uint256);
}
