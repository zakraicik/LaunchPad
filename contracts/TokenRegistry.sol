//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./abstracts/PlatformAdminAccessControl.sol";
import "./libraries/TokenRegistryLibary.sol";

/**
 * @title TokenRegistry
 * @author Generated with assistance from an LLM
 * @notice Registry for managing supported tokens and their configurations
 * @dev Handles token validation, minimum contribution amounts, and token support status
 */
contract TokenRegistry is Ownable, PlatformAdminAccessControl {
    // Use the TokenRegistryLibrary
    using TokenRegistryLibrary for *;

    // Operation types for events
    /**
     * @dev Constant defining token addition operation type for events
     */
    uint8 private constant OP_TOKEN_ADDED = 1;

    /**
     * @dev Constant defining token removal operation type for events
     */
    uint8 private constant OP_TOKEN_REMOVED = 2;

    /**
     * @dev Constant defining token support disabling operation type for events
     */
    uint8 private constant OP_TOKEN_SUPPORT_DISABLED = 3;

    /**
     * @dev Constant defining token support enabling operation type for events
     */
    uint8 private constant OP_TOKEN_SUPPORT_ENABLED = 4;

    /**
     * @dev Constant defining minimum contribution update operation type for events
     */
    uint8 private constant OP_MIN_CONTRIBUTION_UPDATED = 5;

    // Error codes for consolidated errors
    /**
     * @dev Error code for invalid address
     */
    uint8 private constant ERR_INVALID_ADDRESS = 1;

    /**
     * @dev Error code for invalid token
     */
    uint8 private constant ERR_INVALID_TOKEN = 2;

    /**
     * @dev Error code for token already existing in registry
     */
    uint8 private constant ERR_TOKEN_ALREADY_IN_REGISTRY = 3;

    /**
     * @dev Error code for token not found in registry
     */
    uint8 private constant ERR_TOKEN_NOT_IN_REGISTRY = 4;

    /**
     * @dev Error code for token support already enabled
     */
    uint8 private constant ERR_TOKEN_SUPPORT_ALREADY_ENABLED = 5;

    /**
     * @dev Error code for token support already disabled
     */
    uint8 private constant ERR_TOKEN_SUPPORT_ALREADY_DISABLED = 6;

    /**
     * @dev Error code for address not being a contract
     */
    uint8 private constant ERR_NOT_A_CONTRACT = 7;

    /**
     * @dev Error code for token not complying with ERC20 standard
     */
    uint8 private constant ERR_NOT_ERC20_COMPLIANT = 8;

    /**
     * @dev Error code for invalid minimum contribution amount
     */
    uint8 private constant ERR_INVALID_MIN_CONTRIBUTION = 9;

    /**
     * @dev Error code for arithmetic overflow
     */
    uint8 private constant ERR_OVERFLOW = 10;

    /**
     * @notice Configuration struct for each token
     * @dev Stores token support status, decimals, and minimum contribution amount
     */
    struct TokenConfig {
        bool isSupported;
        uint8 decimals;
        uint256 minimumContributionAmount;
    }

    // State variables
    /**
     * @notice Maps token addresses to their configurations
     * @dev Contains support status, decimals, and minimum contribution amount for each token
     */
    mapping(address => TokenConfig) public tokenConfigs;

    /**
     * @notice Maps token addresses to their existence in the registry
     * @dev True if token has been added (even if currently disabled), false otherwise
     */
    mapping(address => bool) private tokenExists;

    /**
     * @notice Array of all currently supported token addresses
     * @dev Used to enumerate all supported tokens
     */
    address[] public supportedTokens;

    /**
     * @notice Thrown when a token registry operation fails
     * @param code Error code identifying the failure reason
     * @param token Address of the token involved
     * @param value Related value (if applicable)
     */
    error TokenRegistryError(uint8 code, address token, uint256 value);

    /**
     * @notice Emitted when a token registry operation is performed
     * @param opType Type of operation (1=add, 2=remove, 3=disable, 4=enable, 5=update min)
     * @param token Address of the token involved
     * @param value Related value (e.g., minimum contribution amount)
     * @param decimals Number of decimals for the token
     */
    event TokenRegistryOperation(
        uint8 opType,
        address indexed token,
        uint256 value,
        uint8 decimals
    );

    /**
     * @notice Creates a new TokenRegistry contract
     * @dev Sets up initial owner and platform admin
     * @param _owner Address of the contract owner
     * @param _platformAdmin Address of the platform admin contract
     */
    constructor(
        address _owner,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {}

    /**
     * @notice Checks if a token is supported by the platform
     * @dev Reverts if token is not in registry
     * @param token Address of the token to check
     * @return True if the token is supported, false otherwise
     */
    function isTokenSupported(address token) external view returns (bool) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }

        return tokenConfigs[token].isSupported;
    }

    /**
     * @notice Adds a new token to the registry
     * @dev Validates token ERC20 compliance and sets initial configuration
     * @param _token Address of the token to add
     * @param _minimumContributionInWholeTokens Minimum contribution amount in whole tokens
     */
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

    /**
     * @notice Removes a token from the registry
     * @dev Completely removes token and its configuration
     * @param _token Address of the token to remove
     */
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

    /**
     * @notice Disables support for a token without removing it
     * @dev Token remains in registry but is not considered supported
     * @param _token Address of the token to disable
     */
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

    /**
     * @notice Enables support for a previously added token
     * @dev Adds token back to supported tokens array
     * @param _token Address of the token to enable
     */
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

    /**
     * @notice Updates the minimum contribution amount for a token
     * @dev Converts whole tokens to smallest units based on token decimals
     * @param _token Address of the token to update
     * @param _minimumContributionInWholeTokens New minimum contribution in whole tokens
     */
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

    /**
     * @notice Gets the minimum contribution amount for a specific token
     * @dev Returns both the amount and the token decimals
     * @param token Address of the token to query
     * @return minimumAmount Minimum contribution amount in token's smallest unit
     * @return decimals Number of decimals for the token
     */
    function getMinContributionAmount(
        address token
    ) external view returns (uint256 minimumAmount, uint8 decimals) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }
        TokenConfig memory config = tokenConfigs[token];
        return (config.minimumContributionAmount, config.decimals);
    }

    /**
     * @notice Gets the decimal places for a specific token
     * @dev Reverts if token is not in registry
     * @param token Address of the token to query
     * @return Number of decimal places for the token
     */
    function getTokenDecimals(address token) external view returns (uint8) {
        if (!tokenExists[token]) {
            revert TokenRegistryError(ERR_TOKEN_NOT_IN_REGISTRY, token, 0);
        }
        return tokenConfigs[token].decimals;
    }

    /**
     * @notice Returns all supported token addresses
     * @dev Returns the array of currently supported tokens
     * @return Array of supported token addresses
     */
    function getAllSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @notice Utility function to convert from smallest token unit to whole tokens
     * @dev Exposed for testing purposes
     * @param amount Amount in smallest token unit
     * @param decimals Number of decimals for the token
     * @return Converted amount in whole tokens
     */
    function testConvertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) public pure returns (uint256) {
        return TokenRegistryLibrary.convertFromSmallestUnit(amount, decimals);
    }
}
