//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TokenRegistry.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IQuoter.sol";
import "./interfaces/IWETH.sol";

contract DefiIntegrationManager is Ownable, ReentrancyGuard  {
    using SafeERC20 for IERC20;

    IAavePool public aavePool;
    ISwapRouter public uniswapRouter;
    IQuoter public uniswapQuoter;
    TokenRegistry public tokenRegistry;

    address public campaignFactory;
    mapping(address => bool) public authorizedCampaigns;

    mapping(address => mapping(address => uint256)) public aaveDeposits;

    uint24 public constant UNISWAP_FEE_TIER = 3000; // 0.3%
    uint256 public constant SLIPPAGE_TOLERANCE = 50;

    error UnauthorizedAddress();
    error invalidCampaignFactory(address campaignFactory);
    error ZeroAmount(uint256 amount);
    error InsufficientDeposit(address token, uint256 requested, uint256 available);
    error TokenNotSupported(address token);
    error SlippageExceeded(uint256 expected, uint256 received);
    error YieldDepositFailed(string reason);
    error YieldWithdrawlFailed(string reason);
    error InvalidAddress();
    error WithdrawalAmountMismatch(uint256 requestedAmount, uint256 withdrawAmount);

    event YieldDeposited(address indexed campaign, address indexed token, uint256 amount);
    event YieldWithdrawn(address indexed campaign, address indexed token, uint256 amount);
    event YieldHarvested(address indexed campaign, address indexed token, uint256 yieldAmount);
    event TokenSwapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event CampaignAuthorized(address indexed campaign);
    event CampaignUnauthorized(address indexed campaign);
    event ContractFactoryUpdated(address oldAddress, address newAddress);
    event AavePoolUpdated(address oldAddress, address newAddress);
    event UniswapRouterUpdated(address oldAddress, address newAddress);
    event UniswapQuoterUpdated(address oldAddress, address newAddress);

    constructor(
        address _aavePool, 
        address _uniswapRouter, 
        address _uniswapQuoter, 
        address _tokenRegistry, 
        address _owner
    ) Ownable(_owner) {

        if (_aavePool == address(0) || _uniswapRouter == address(0) || 
            _uniswapQuoter == address(0) || _tokenRegistry == address(0)) {
            revert InvalidAddress();
        }
        aavePool = IAavePool(_aavePool);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        uniswapQuoter = IQuoter(_uniswapQuoter);
        tokenRegistry =  TokenRegistry(_tokenRegistry);
    }

    modifier onlyCampaignFactory() {
        if (msg.sender != campaignFactory) {
            revert invalidCampaignFactory(campaignFactory);
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
        if (_campaignFactory == address(0)){
            revert InvalidAddress();
        }

        address oldFactory = campaignFactory;
        campaignFactory = _campaignFactory;

        emit ContractFactoryUpdated(oldFactory, _campaignFactory);
    }

    function authorizeCampaign(address _campaign) external onlyCampaignFactory {

        authorizedCampaigns[_campaign] = true;

        emit CampaignAuthorized(_campaign);

    }

    function unauthorizeCampaign(address _campaign) external onlyOwner{
        authorizedCampaigns[_campaign] = false;

        emit CampaignUnauthorized(_campaign);
    }


    function setAavePool(address _aavePool) external onlyOwner{
        if (_aavePool == address(0)){
            revert InvalidAddress();
        }

        address oldAavePool = address(aavePool);
        aavePool = IAavePool(_aavePool);
        emit AavePoolUpdated(oldAavePool, _aavePool);
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner{
        if (_uniswapRouter == address(0)){
            revert InvalidAddress();
        }

        address oldUniswapRouter = address(uniswapRouter);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        emit UniswapRouterUpdated(oldUniswapRouter, _uniswapRouter);

    }

    function setUniswapQuoter(address _uniswapQuoter) external onlyOwner {
        if (_uniswapQuoter == address(0)){
            revert InvalidAddress();
        }

        address oldUniswapQuoter = address(uniswapQuoter);
        uniswapQuoter = IQuoter(_uniswapQuoter);
        emit UniswapQuoterUpdated(oldUniswapQuoter, _uniswapQuoter);

    }

    function depositToYieldProtocol(address _token, uint256 _amount) external onlyCampaign nonReentrant {
        if (_amount <= 0) {
            revert ZeroAmount(_amount);
        }

        if (!tokenRegistry.isTokenSupported(_token)){
            revert TokenNotSupported(_token);
        }

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(address(aavePool), _amount);

        try aavePool.supply(_token, _amount, address(this), 0) {
            aaveDeposits[msg.sender][_token] += _amount;

            emit YieldDeposited(msg.sender, _token, _amount);
        } catch Error(string memory reason){
            revert YieldDepositFailed(reason);
        } catch {
            revert YieldDepositFailed("Aave deposit failed");
        }
    }

    function withdrawFromYieldProtocol(address _token, uint256 _amount) external onlyCampaign nonReentrant returns (uint256) {
        if (_amount <= 0) {
            revert ZeroAmount(_amount);
        }

        uint256 deposited = aaveDeposits[msg.sender][_token];
        if(_amount > deposited){
            revert InsufficientDeposit(_token, _amount, deposited);
        }

        try aavePool.withdraw(_token, _amount, address(this)) returns(uint256 withdrawn) {
            if (withdrawn != _amount) {
                revert WithdrawalAmountMismatch(_amount, withdrawn);
            }

            aaveDeposits[msg.sender][_token] -= _amount;

            IERC20(_token).safeTransfer(msg.sender, withdrawn);

            emit YieldWithdrawn(msg.sender, _token, withdrawn);

            return withdrawn;
        } catch Error(string memory reason){
            revert YieldWithdrawlFailed(reason);
        } catch {
            revert YieldWithdrawlFailed("Aave withdrawl failed.");
        }
    }

    function withdrawAllFromYieldProtocol(address _token) external onlyCampaign nonReentrant returns(uint256){
        uint256 amount = aaveDeposits[msg.sender][_token];

        if (amount <= 0){
            revert ZeroAmount(amount);
        }

        try aavePool.withdraw(_token, amount, address(this)) returns(uint256 withdrawn){
            if(withdrawn != amount){
                revert WithdrawalAmountMismatch(amount, withdrawn);
            }

            aaveDeposits[msg.sender][_token] = 0;

            IERC20(_token).safeTransfer(msg.sender, withdrawn);

            emit YieldWithdrawn(msg.sender, _token, withdrawn);

            return withdrawn;
        } catch Error(string memory reason){
            revert YieldWithdrawlFailed(reason);
        } catch {
            revert YieldWithdrawlFailed("Aave withdrawl failed.");
        }        
    }

}