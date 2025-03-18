//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ITokenRegistry.sol";
import "./IYieldDistributor.sol";
import "./IAavePool.sol";
import "./ISwapRouter.sol";
import "./IQuoter.sol";

interface IDefiIntegrationManager {
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

    function getTargetTokenEquivalent(
        address _fromToken,
        uint256 _amount,
        address _toToken
    ) external view returns (uint256);

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate);

    function getDepositedAmount(
        address campaign,
        address token
    ) external view returns (uint256 amount);

    function setTokenRegistry(address _tokenRegistry) external;

    function setYieldDistributor(address _yieldDistributor) external;

    function setAavePool(address _aavePool) external;

    function setUniswapRouter(address _uniswapRouter) external;

    function setUniswapQuoter(address _uniswapQuoter) external;

    function tokenRegistry() external view returns (ITokenRegistry);

    function yieldDistributor() external view returns (IYieldDistributor);

    function aavePool() external view returns (IAavePool);

    function uniswapRouter() external view returns (ISwapRouter);

    function uniswapQuoter() external view returns (IQuoter);
}
