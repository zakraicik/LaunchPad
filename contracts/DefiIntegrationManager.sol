//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IYieldDistributor.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IQuoter.sol";

contract DefiIntegrationManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IAavePool public aavePool;
    ISwapRouter public uniswapRouter;
    IQuoter public uniswapQuoter;
    ITokenRegistry public tokenRegistry;
    IYieldDistributor public yieldDistributor;
    address public campaignFactory;

    uint24 public constant UNISWAP_FEE_TIER = 3000; // 0.3%
    uint16 public constant SLIPPAGE_TOLERANCE = 50; // Changed from uint256 to uint16

    mapping(address => bool) public authorizedCampaigns;
    mapping(address => mapping(address => uint256)) public aaveDeposits;

    error UnauthorizedAddress();
    error notCampaignFactory(address campaignFactory);
    error ZeroAmount(uint256 amount);
    error InsufficientDeposit(
        address token,
        uint256 requested,
        uint256 available
    );
    error TokenNotSupported(address token);
    error SlippageExceeded(uint256 expected, uint256 received);
    error YieldDepositFailed(string reason);
    error YieldwithdrawalFailed(string reason);
    error InvalidAddress();
    error InvalidConstructorInput(uint8, address);
    error NoYield(address token);
    error WithdrawalAmountMismatch(
        uint256 requestedAmount,
        uint256 withdrawAmount
    );
    error FailedToGetATokenAddress();
    error TokensAreTheSame(address fromToken, address outToken);
    error SwapQuoteInvalid();
    error SwapFailed(string reason);

    event YieldDeposited(
        address indexed campaign,
        address indexed token,
        uint256 amount
    );
    event YieldWithdrawn(
        address indexed campaign,
        address indexed token,
        uint256 amount
    );
    event YieldHarvested(
        address indexed campaign,
        address indexed token,
        uint256 totalYield,
        uint256 creatorShare,
        uint256 platformShare
    );
    event TokenSwapped(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event CampaignAuthorized(address indexed campaign);
    event CampaignUnauthorized(address indexed campaign);
    event CampaignFactoryUpdated(address oldAddress, address newAddress);
    event AavePoolUpdated(address oldAddress, address newAddress);
    event TokenRegistryUpdated(address oldAddress, address newAddress);
    event YieldDistributorUpdated(address oldAddress, address newAddress);
    event UniswapRouterUpdated(address oldAddress, address newAddress);
    event UniswapQuoterUpdated(address oldAddress, address newAddress);

    constructor(
        address _aavePool,
        address _uniswapRouter,
        address _uniswapQuoter,
        address _tokenRegistry,
        address _campaignFactory,
        address _yieldDistributor,
        address _owner
    ) Ownable(_owner) {
        if (_aavePool == address(0)) {
            revert InvalidConstructorInput(0, _aavePool);
        }

        if (_uniswapRouter == address(0)) {
            revert InvalidConstructorInput(1, _uniswapRouter);
        }

        if (_uniswapQuoter == address(0)) {
            revert InvalidConstructorInput(2, _uniswapQuoter);
        }

        if (_tokenRegistry == address(0)) {
            revert InvalidConstructorInput(3, _tokenRegistry);
        }

        if (_campaignFactory == address(0)) {
            revert InvalidConstructorInput(4, _campaignFactory);
        }

        if (_yieldDistributor == address(0)) {
            revert InvalidConstructorInput(5, _yieldDistributor);
        }

        aavePool = IAavePool(_aavePool);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        uniswapQuoter = IQuoter(_uniswapQuoter);
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        campaignFactory = _campaignFactory;
        yieldDistributor = IYieldDistributor(_yieldDistributor);
    }

    modifier onlyCampaignFactory() {
        if (msg.sender != campaignFactory) {
            revert notCampaignFactory(msg.sender);
        }
        _;
    }

    modifier onlyCampaign() {
        if (!authorizedCampaigns[msg.sender]) {
            revert UnauthorizedAddress();
        }
        _;
    }

    function setCampaignFactory(address _campaignFactory) external onlyOwner {
        if (_campaignFactory == address(0)) {
            revert InvalidAddress();
        }

        address oldFactory = campaignFactory;
        campaignFactory = _campaignFactory;

        emit CampaignFactoryUpdated(oldFactory, _campaignFactory);
    }

    function setTokenRegistry(address _tokenRegistry) external onlyOwner {
        if (_tokenRegistry == address(0)) {
            revert InvalidAddress();
        }

        address oldRegistry = address(tokenRegistry);
        tokenRegistry = ITokenRegistry(_tokenRegistry);

        emit TokenRegistryUpdated(oldRegistry, _tokenRegistry);
    }

    function setYieldDistributor(address _yieldDistributor) external onlyOwner {
        if (_yieldDistributor == address(0)) {
            revert InvalidAddress();
        }

        address oldDistributor = address(yieldDistributor);
        yieldDistributor = IYieldDistributor(_yieldDistributor);

        emit YieldDistributorUpdated(oldDistributor, _yieldDistributor);
    }

    function setAavePool(address _aavePool) external onlyOwner {
        if (_aavePool == address(0)) {
            revert InvalidAddress();
        }

        address oldAavePool = address(aavePool);
        aavePool = IAavePool(_aavePool);
        emit AavePoolUpdated(oldAavePool, _aavePool);
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner {
        if (_uniswapRouter == address(0)) {
            revert InvalidAddress();
        }

        address oldUniswapRouter = address(uniswapRouter);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        emit UniswapRouterUpdated(oldUniswapRouter, _uniswapRouter);
    }

    function setUniswapQuoter(address _uniswapQuoter) external onlyOwner {
        if (_uniswapQuoter == address(0)) {
            revert InvalidAddress();
        }

        address oldUniswapQuoter = address(uniswapQuoter);
        uniswapQuoter = IQuoter(_uniswapQuoter);
        emit UniswapQuoterUpdated(oldUniswapQuoter, _uniswapQuoter);
    }

    function authorizeCampaign(address _campaign) external onlyCampaignFactory {
        authorizedCampaigns[_campaign] = true;
        emit CampaignAuthorized(_campaign);
    }

    function unauthorizeCampaign(address _campaign) external onlyOwner {
        authorizedCampaigns[_campaign] = false;
        emit CampaignUnauthorized(_campaign);
    }

    function depositToYieldProtocol(
        address _token,
        uint256 _amount
    ) external onlyCampaign nonReentrant {
        if (_amount <= 0) {
            revert ZeroAmount(_amount);
        }

        if (!tokenRegistry.isTokenSupported(_token)) {
            revert TokenNotSupported(_token);
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(address(aavePool), _amount);

        try aavePool.supply(_token, _amount, address(this), 0) {
            aaveDeposits[msg.sender][_token] += _amount;
            emit YieldDeposited(msg.sender, _token, _amount);
        } catch Error(string memory reason) {
            revert YieldDepositFailed(reason);
        } catch {
            revert YieldDepositFailed("Aave deposit failed");
        }
    }

    function withdrawFromYieldProtocol(
        address _token,
        uint256 _amount
    ) external onlyCampaign nonReentrant returns (uint256) {
        if (_amount <= 0) {
            revert ZeroAmount(_amount);
        }

        uint256 deposited = aaveDeposits[msg.sender][_token];
        if (_amount > deposited) {
            revert InsufficientDeposit(_token, _amount, deposited);
        }

        try aavePool.withdraw(_token, _amount, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != _amount) {
                revert WithdrawalAmountMismatch(_amount, withdrawn);
            }

            aaveDeposits[msg.sender][_token] -= _amount;
            IERC20(_token).safeTransfer(msg.sender, withdrawn);
            emit YieldWithdrawn(msg.sender, _token, withdrawn);

            return withdrawn;
        } catch Error(string memory reason) {
            revert YieldwithdrawalFailed(reason);
        } catch {
            revert YieldwithdrawalFailed("Aave withdrawal failed.");
        }
    }

    function withdrawAllFromYieldProtocol(
        address _token
    ) external onlyCampaign nonReentrant returns (uint256) {
        uint256 amount = aaveDeposits[msg.sender][_token];

        if (amount <= 0) {
            revert ZeroAmount(amount);
        }

        try aavePool.withdraw(_token, amount, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != amount) {
                revert WithdrawalAmountMismatch(amount, withdrawn);
            }

            aaveDeposits[msg.sender][_token] = 0;
            IERC20(_token).safeTransfer(msg.sender, withdrawn);
            emit YieldWithdrawn(msg.sender, _token, withdrawn);

            return withdrawn;
        } catch Error(string memory reason) {
            revert YieldwithdrawalFailed(reason);
        } catch {
            revert YieldwithdrawalFailed("Aave withdrawal failed.");
        }
    }

    function harvestYield(
        address _token
    )
        external
        onlyCampaign
        nonReentrant
        returns (uint256 creatorYield, uint256 platformYield)
    {
        uint256 deposited = aaveDeposits[msg.sender][_token];
        if (deposited <= 0) {
            revert NoYield(_token);
        }

        address aToken;
        try aavePool.getReserveData(_token) returns (
            DataTypes.ReserveData memory data
        ) {
            aToken = data.aTokenAddress;
        } catch {
            revert FailedToGetATokenAddress();
        }

        if (aToken == address(0)) {
            revert InvalidAddress();
        }

        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance <= deposited) {
            revert NoYield(_token);
        }

        uint256 totalYield = aTokenBalance - deposited;

        try aavePool.withdraw(_token, totalYield, address(this)) returns (
            uint256 withdrawn
        ) {
            if (withdrawn != totalYield) {
                revert WithdrawalAmountMismatch(totalYield, withdrawn);
            }

            (creatorYield, platformYield) = yieldDistributor
                .calculateYieldShares(withdrawn);

            IERC20(_token).safeTransfer(msg.sender, creatorYield);

            address treasury = yieldDistributor.getPlatformTreasury();
            IERC20(_token).safeTransfer(treasury, platformYield);

            emit YieldHarvested(
                msg.sender,
                _token,
                withdrawn,
                creatorYield,
                platformYield
            );
            return (creatorYield, platformYield);
        } catch Error(string memory reason) {
            revert YieldwithdrawalFailed(reason);
        } catch {
            revert YieldwithdrawalFailed("Yield withdrawal failed.");
        }
    }

    function getTargetTokenEquivalent(
        address _fromToken,
        uint256 _amount,
        address _toToken
    ) public view returns (uint256) {
        if (_fromToken == _toToken) {
            revert TokensAreTheSame(_fromToken, _toToken);
        }

        try
            uniswapQuoter.quoteExactInputSingle(
                _fromToken,
                _toToken,
                UNISWAP_FEE_TIER,
                _amount,
                0
            )
        returns (uint256 quote) {
            return quote;
        } catch {
            return 0;
        }
    }

    function swapTokenForTarget(
        address _fromToken,
        uint256 _amount,
        address _toToken
    ) external onlyCampaign nonReentrant returns (uint256) {
        if (_amount <= 0) {
            revert ZeroAmount(_amount);
        }

        if (!tokenRegistry.isTokenSupported(_fromToken)) {
            revert TokenNotSupported(_fromToken);
        }

        if (!tokenRegistry.isTokenSupported(_toToken)) {
            revert TokenNotSupported(_toToken);
        }

        if (_fromToken == _toToken) {
            revert TokensAreTheSame(_fromToken, _toToken);
        }

        uint256 expectedOut = getTargetTokenEquivalent(
            _fromToken,
            _amount,
            _toToken
        );
        if (expectedOut == 0) {
            revert SwapQuoteInvalid();
        }

        uint256 minAmountOut = (expectedOut * (10000 - SLIPPAGE_TOLERANCE)) /
            10000;

        IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_fromToken).safeIncreaseAllowance(
            address(uniswapRouter),
            _amount
        );

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _fromToken,
                tokenOut: _toToken,
                fee: UNISWAP_FEE_TIER,
                recipient: address(this),
                deadline: block.timestamp + 15 minutes,
                amountIn: _amount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        try uniswapRouter.exactInputSingle(params) returns (uint256 received) {
            if (received < minAmountOut) {
                revert SlippageExceeded(minAmountOut, received);
            }

            IERC20(_toToken).safeTransfer(msg.sender, received);
            emit TokenSwapped(_fromToken, _toToken, _amount, received);

            return received;
        } catch Error(string memory reason) {
            revert SwapFailed(reason);
        } catch {
            revert SwapFailed("Uniswap swap failed.");
        }
    }

    function getCurrentYieldRate(
        address token
    ) external view returns (uint256 yieldRate) {
        try aavePool.getReserveData(token) returns (
            DataTypes.ReserveData memory data
        ) {
            return (data.currentLiquidityRate * 10000) / 1e27;
        } catch {
            return 0;
        }
    }

    function getDepositedAmount(
        address campaign,
        address token
    ) external view returns (uint256 amount) {
        return aaveDeposits[campaign][token];
    }

    function isCampaignAuthorized(
        address campaign
    ) external view returns (bool isAuthorized) {
        return authorizedCampaigns[campaign];
    }

    function getTokenRegistry() external view returns (ITokenRegistry) {
        return tokenRegistry;
    }
}
