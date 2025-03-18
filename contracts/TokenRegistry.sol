//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/TokenRegistryLibary.sol";

contract TokenRegistry is Ownable, PlatformAdminAccessControl {
    // Use the TokenRegistryLibrary
    using TokenRegistryLibrary for *;

    // Operation types for events
    uint8 private constant OP_TOKEN_ADDED = 1;
    uint8 private constant OP_TOKEN_REMOVED = 2;
    uint8 private constant OP_TOKEN_SUPPORT_DISABLED = 3;
    uint8 private constant OP_TOKEN_SUPPORT_ENABLED = 4;
    uint8 private constant OP_MIN_CONTRIBUTION_UPDATED = 5;

    // Error codes for consolidated errors
    uint8 private constant ERR_INVALID_ADDRESS = 1;
    uint8 private constant ERR_INVALID_TOKEN = 2;
    uint8 private constant ERR_TOKEN_ALREADY_IN_REGISTRY = 3;
    uint8 private constant ERR_TOKEN_NOT_IN_REGISTRY = 4;
    uint8 private constant ERR_TOKEN_SUPPORT_ALREADY_ENABLED = 5;
    uint8 private constant ERR_TOKEN_SUPPORT_ALREADY_DISABLED = 6;
    uint8 private constant ERR_NOT_A_CONTRACT = 7;
    uint8 private constant ERR_NOT_ERC20_COMPLIANT = 8;
    uint8 private constant ERR_INVALID_MIN_CONTRIBUTION = 9;
    uint8 private constant ERR_OVERFLOW = 10;

    struct TokenConfig {
        bool isSupported;
        uint8 decimals;
        uint256 minimumContributionAmount;
    }

    // State variables
    mapping(address => TokenConfig) public tokenConfigs;
    mapping(address => bool) private tokenExists;
    address[] public supportedTokens;

    // Consolidated error with error code
    error TokenRegistryError(uint8 code, address token, uint256 value);

    // Consolidated event
    event TokenRegistryOperation(
        uint8 opType,
        address indexed token,
        uint256 value,
        uint8 decimals
    );

    constructor(
        address _owner,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {}

    function isTokenSupported(address token) external view returns (bool) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }

        return tokenConfigs[token].isSupported;
    }

    function addToken(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external onlyPlatformAdmin {
        if (tokenExists[_token]) {
            revert TokenRegistryError(ERR_TOKEN_ALREADY_IN_REGISTRY, _token, 0);
        }

        // Use library function to validate token and get decimals
        (uint8 decimals, bool isValid) = TokenRegistryLibrary
            .validateAndGetDecimals(_token);

        if (!isValid) {
            if (_token == address(0)) {
                revert TokenRegistryError(ERR_INVALID_ADDRESS, _token, 0);
            }

            uint256 codeSize;
            assembly {
                codeSize := extcodesize(_token)
            }
            if (codeSize == 0) {
                revert TokenRegistryError(ERR_NOT_A_CONTRACT, _token, 0);
            }

            revert TokenRegistryError(ERR_NOT_ERC20_COMPLIANT, _token, 0);
        }

        // Use library function to convert the amount
        uint256 minimumContributionInSmallestUnit = TokenRegistryLibrary
            .convertToSmallestUnit(_minimumContributionInWholeTokens, decimals);

        // Check for overflow
        if (
            minimumContributionInSmallestUnit == 0 &&
            _minimumContributionInWholeTokens > 0
        ) {
            revert TokenRegistryError(
                ERR_OVERFLOW,
                _token,
                _minimumContributionInWholeTokens
            );
        }

        tokenConfigs[_token] = TokenConfig({
            isSupported: true,
            minimumContributionAmount: minimumContributionInSmallestUnit,
            decimals: decimals
        });

        tokenExists[_token] = true;
        supportedTokens.push(_token);

        emit TokenRegistryOperation(
            OP_TOKEN_ADDED,
            _token,
            minimumContributionInSmallestUnit,
            decimals
        );
    }

    function removeToken(address _token) external onlyPlatformAdmin {
        if (!tokenExists[_token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, _token, 0);
        }

        delete tokenConfigs[_token];
        delete tokenExists[_token];

        // Use library function to remove from array
        TokenRegistryLibrary.removeFromArray(supportedTokens, _token);

        emit TokenRegistryOperation(OP_TOKEN_REMOVED, _token, 0, 0);
    }

    function disableTokenSupport(address _token) external onlyPlatformAdmin {
        if (!tokenExists[_token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, _token, 0);
        }

        if (!tokenConfigs[_token].isSupported) {
            revert TokenRegistryError(
                ERR_TOKEN_SUPPORT_ALREADY_DISABLED,
                _token,
                0
            );
        }

        tokenConfigs[_token].isSupported = false;

        // Use library function to remove from array
        TokenRegistryLibrary.removeFromArray(supportedTokens, _token);

        emit TokenRegistryOperation(OP_TOKEN_SUPPORT_DISABLED, _token, 0, 0);
    }

    function enableTokenSupport(address _token) external onlyPlatformAdmin {
        if (!tokenExists[_token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, _token, 0);
        }

        if (tokenConfigs[_token].isSupported) {
            revert TokenRegistryError(
                ERR_TOKEN_SUPPORT_ALREADY_ENABLED,
                _token,
                0
            );
        }

        tokenConfigs[_token].isSupported = true;
        supportedTokens.push(_token);

        emit TokenRegistryOperation(OP_TOKEN_SUPPORT_ENABLED, _token, 0, 0);
    }

    function updateTokenMinimumContribution(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external onlyPlatformAdmin {
        if (!tokenExists[_token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, _token, 0);
        }

        TokenConfig storage config = tokenConfigs[_token];

        // Use library function to convert the amount
        uint256 minimumContributionInSmallestUnit = TokenRegistryLibrary
            .convertToSmallestUnit(
                _minimumContributionInWholeTokens,
                config.decimals
            );

        // Check for overflow
        if (
            minimumContributionInSmallestUnit == 0 &&
            _minimumContributionInWholeTokens > 0
        ) {
            revert TokenRegistryError(
                ERR_OVERFLOW,
                _token,
                _minimumContributionInWholeTokens
            );
        }

        config.minimumContributionAmount = minimumContributionInSmallestUnit;

        emit TokenRegistryOperation(
            OP_MIN_CONTRIBUTION_UPDATED,
            _token,
            minimumContributionInSmallestUnit,
            0
        );
    }

    function getMinContributionAmount(
        address token
    ) external view returns (uint256 minimumAmount, uint8 decimals) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }
        TokenConfig memory config = tokenConfigs[token];
        return (config.minimumContributionAmount, config.decimals);
    }

    function getTokenDecimals(address token) external view returns (uint8) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }
        return tokenConfigs[token].decimals;
    }

    function getAllSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function testConvertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) public pure returns (uint256) {
        return TokenRegistryLibrary.convertFromSmallestUnit(amount, decimals);
    }
}
