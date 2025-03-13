//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./abstracts/PlatformAdminAccessControl.sol";

contract TokenRegistry is Ownable, PlatformAdminAccessControl {
    constructor(
        address _owner,
        address _platformAdmin
    ) Ownable(_owner) PlatformAdminAccessControl(_platformAdmin) {}

    struct TokenConfig {
        bool isSupported;
        uint8 decimals;
        uint256 minimumContributionAmount;
    }

    mapping(address => TokenConfig) public tokenConfigs;
    mapping(address => bool) private tokenExists;
    address[] public supportedTokens;

    error InvalidAddress();
    error InvalidToken(address _token);
    error TokenAlreadyInRegistry(address _token);
    error TokenNotInRegistry(address _token);
    error TokenSupportAlreadyEnabled(address _token);
    error TokenSupportAlreadyDisabled(address _token);
    error NotAContract(address providedAddress);
    error NotERC20Compliant(address providedAddress);
    error InvalidMinimumContribution();
    error Overflow();

    event TokenAdded(
        address indexed token,
        uint256 minimumContributionAmount,
        uint8 decimals
    );
    event TokenRemovedFromRegistry(address indexed token);
    event TokenSupportDisabled(address indexed token);
    event TokenSupportEnabled(address indexed token);
    event TokenMinimumContributionUpdated(
        address indexed token,
        uint256 minimumContributionAmount
    );

    function _convertToSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (amount > type(uint256).max / (10 ** decimals)) {
            revert Overflow();
        }
        return amount * (10 ** decimals);
    }

    function _convertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256) {
        return amount / (10 ** decimals);
    }

    function _validateAndGetDecimals(
        address _token
    ) internal view returns (uint8) {
        if (_token == address(0)) {
            revert InvalidToken(_token);
        }

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(_token)
        }
        if (codeSize == 0) {
            revert NotAContract(_token);
        }

        try IERC20Metadata(_token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            revert NotERC20Compliant(_token);
        }
    }

    function _tokenExists(address token) internal view returns (bool) {
        return tokenExists[token];
    }

    function _tokenSupported(address token) internal view returns (bool) {
        return tokenConfigs[token].isSupported;
    }

    function isTokenSupported(address token) external view returns (bool) {
        if (!_tokenExists(token)) {
            revert TokenNotInRegistry(token);
        }

        return tokenConfigs[token].isSupported;
    }

    function addToken(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external onlyPlatformAdmin {
        if (_tokenExists(_token)) {
            revert TokenAlreadyInRegistry(_token);
        }

        uint8 decimals = _validateAndGetDecimals(_token);
        uint256 minimumContributionInSmallestUnit = _convertToSmallestUnit(
            _minimumContributionInWholeTokens,
            decimals
        );

        tokenConfigs[_token] = TokenConfig({
            isSupported: true,
            minimumContributionAmount: minimumContributionInSmallestUnit,
            decimals: decimals
        });

        tokenExists[_token] = true;
        supportedTokens.push(_token);

        emit TokenAdded(_token, minimumContributionInSmallestUnit, decimals);
    }

    function removeToken(address _token) external onlyPlatformAdmin {
        if (!_tokenExists(_token)) {
            revert TokenNotInRegistry(_token);
        }

        delete tokenConfigs[_token];
        delete tokenExists[_token];

        if (supportedTokens.length > 0) {
            for (uint256 i = 0; i < supportedTokens.length; i++) {
                if (supportedTokens[i] == _token) {
                    supportedTokens[i] = supportedTokens[
                        supportedTokens.length - 1
                    ];
                    supportedTokens.pop();
                    break;
                }
            }
        }

        emit TokenRemovedFromRegistry(_token);
    }

    function disableTokenSupport(address _token) external onlyPlatformAdmin {
        if (!_tokenExists(_token)) {
            revert TokenNotInRegistry(_token);
        }

        if (!_tokenSupported(_token)) {
            revert TokenSupportAlreadyDisabled(_token);
        }

        tokenConfigs[_token].isSupported = false;

        if (supportedTokens.length > 0) {
            for (uint256 i = 0; i < supportedTokens.length; i++) {
                if (supportedTokens[i] == _token) {
                    supportedTokens[i] = supportedTokens[
                        supportedTokens.length - 1
                    ];
                    supportedTokens.pop();
                    break;
                }
            }
        }

        emit TokenSupportDisabled(_token);
    }

    function enableTokenSupport(address _token) external onlyPlatformAdmin {
        if (!_tokenExists(_token)) {
            revert TokenNotInRegistry(_token);
        }

        if (_tokenSupported(_token)) {
            revert TokenSupportAlreadyEnabled(_token);
        }

        tokenConfigs[_token].isSupported = true;
        supportedTokens.push(_token);

        emit TokenSupportEnabled(_token);
    }

    function updateTokenMinimumContribution(
        address _token,
        uint256 _minimumContributionInWholeTokens
    ) external onlyPlatformAdmin {
        if (!_tokenExists(_token)) {
            revert TokenNotInRegistry(_token);
        }

        TokenConfig storage config = tokenConfigs[_token];
        uint256 minimumContributionInSmallestUnit = _convertToSmallestUnit(
            _minimumContributionInWholeTokens,
            config.decimals
        );

        config.minimumContributionAmount = minimumContributionInSmallestUnit;

        emit TokenMinimumContributionUpdated(
            _token,
            minimumContributionInSmallestUnit
        );
    }

    function getMinContributionAmount(
        address token
    ) external view returns (uint256 minimumAmount, uint8 decimals) {
        if (!_tokenExists(token)) {
            revert TokenNotInRegistry(token);
        }
        TokenConfig memory config = tokenConfigs[token];
        return (config.minimumContributionAmount, config.decimals);
    }

    function getAllSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function getTokenDecimals(address token) external view returns (uint8) {
        if (!_tokenExists(token)) {
            revert TokenNotInRegistry(token);
        }
        return tokenConfigs[token].decimals;
    }

    function testConvertFromSmallestUnit(
        uint256 amount,
        uint8 decimals
    ) public pure returns (uint256) {
        return _convertFromSmallestUnit(amount, decimals);
    }
}
