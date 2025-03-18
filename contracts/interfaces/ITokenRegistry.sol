// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITokenRegistry {
    struct TokenConfig {
        bool isSupported;
        uint8 decimals;
        uint256 minimumContributionAmount;
    }

    function isTokenSupported(address token) external view returns (bool);

    function getMinContributionAmount(
        address token
    ) external view returns (uint256 minimumAmount, uint8 decimals);

    function getAllSupportedTokens() external view returns (address[] memory);

    function getTokenDecimals(address token) external view returns (uint8);

    function addToken(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external;

    function removeToken(address _token) external;

    function disableTokenSupport(address _token) external;

    function enableTokenSupport(address _token) external;

    function updateTokenMinimumContribution(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external;

    function testConvertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) external pure returns (uint256);

    function tokenConfigs(
        address
    )
        external
        view
        returns (
            bool isSupported,
            uint8 decimals,
            uint256 minimumContributionAmount
        );

    function supportedTokens(uint256) external view returns (address);
}
