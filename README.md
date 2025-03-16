# DeFi Campaign Platform

A decentralized crowdfunding platform leveraging DeFi protocols to generate yield on contributed funds.

## Overview

This platform allows creators to launch fundraising campaigns where contributions earn yield while the campaign is active. The system integrates with Aave for yield generation and Uniswap for token swaps, enabling multi-token contributions.

## System Architecture

The platform consists of six main smart contracts:

1. `Campaign`: Individual fundraising campaign instance
2. `CampaignContractFactory`: Factory contract to create new campaigns
3. `DefiIntegrationManager`: Manages interactions with DeFi protocols
4. `PlatformAdmin`: Handles platform administration and emergency measures
5. `TokenRegistry`: Manages supported tokens and their configurations
6. `YieldDistributor`: Controls yield distribution between creators and platform

The system also includes supporting contracts in the following directories:

- `abstracts/`: Abstract contracts providing base functionality
- `interfaces/`: Contract interfaces defining standard interactions
- `libraries/`: Utility libraries for common functions
- `mocks/`: Mock contracts for testing purposes

## Contract Details

### Campaign

The `Campaign` contract represents an individual fundraising campaign.

**Features:**

- Fundraising with a goal amount and time limit
- Support for contributions in multiple tokens
- DeFi yield generation on contributed funds
- Weighted contribution calculations for fair yield distribution
- Automatic refunds if the goal is not reached
- Platform administration safety measures

**Key Functions:**

- `contribute(address fromToken, uint256 amount)`: Make a contribution in any supported token
- `requestRefund()`: Request a refund if campaign fails to reach its goal
- `claimFunds()`: Creator claims funds after successful campaign
- `depositToYieldProtocol()`: Deposit funds to earn yield
- `harvestYield()`: Collect generated yield
- `withdrawFromYieldProtocol()`: Withdraw funds from yield protocol
- `calculateWeightedContributions()`: Calculate weighted contributions for all contributors
- `calculateWeightedContributionsBatch(uint256 batchSize)`: Process weighted contributions in batches
- `claimYield()`: Allow contributors to claim their share of generated yield
- `resetWeightedContributionsCalculation()`: Reset the weighted contribution calculation state

### CampaignContractFactory

Factory contract for deploying new campaign instances.

**Features:**

- Creates standardized campaign contracts
- Maintains registry of deployed campaigns
- Associates campaigns with their creators
- Validates campaign parameters before deployment

**Key Functions:**

- `deploy(address _campaignToken, uint256 _campaignGoalAmount, uint16 _campaignDuration)`: Deploy a new campaign
- `getAllCampaigns()`: Get all deployed campaigns
- `getCampaignsByCreator(address _creator)`: Get campaigns by a specific creator
- `getCampaignsCount()`: Get total number of deployed campaigns
- `getCreatorCampaignsCount(address _creator)`: Get number of campaigns by a creator

### DefiIntegrationManager

Manages all interactions with external DeFi protocols.

**Features:**

- Token deposit and withdrawal to/from Aave
- Token swaps via Uniswap
- Yield calculation and distribution
- Slippage protection for swaps
- Configurable protocol integrations

**Key Functions:**

- `depositToYieldProtocol(address _token, uint256 _amount)`: Deposit tokens to Aave
- `withdrawFromYieldProtocol(address _token, uint256 _amount)`: Withdraw tokens from Aave
- `harvestYield(address _token)`: Harvest and distribute yield
- `swapTokenForTarget(address _fromToken, uint256 _amount, address _toToken)`: Swap tokens via Uniswap
- `getCurrentYieldRate(address token)`: Get current yield rate from Aave
- `getDepositedAmount(address campaign, address token)`: Get amount deposited by a campaign

### PlatformAdmin

Handles platform administration and emergency access control.

**Features:**

- Multi-admin support
- Grace period management for emergency interventions
- Campaign status monitoring
- Secure access control

**Key Functions:**

- `addPlatformAdmin(address _admin)`: Add a new platform administrator
- `removePlatformAdmin(address _admin)`: Remove a platform administrator
- `updateGracePeriod(uint256 _gracePeriod)`: Update the grace period
- `isGracePeriodOver(address _campaign)`: Check if grace period is over for a campaign
- `isPlatformAdmin(address account)`: Check if an address is a platform admin

### TokenRegistry

Manages the registry of supported tokens and their configurations.

**Features:**

- Token support management
- Minimum contribution amounts
- Token validation
- Decimal handling for different token standards

**Key Functions:**

- `addToken(address _token, uint256 _minimumContributionInWholeTokens)`: Add a new supported token
- `removeToken(address _token)`: Remove a token from the registry
- `enableTokenSupport(address _token)`: Enable support for a token
- `disableTokenSupport(address _token)`: Disable support for a token
- `updateTokenMinimumContribution(address _token, uint256 _minimumContributionInWholeTokens)`: Update minimum contribution
- `getMinContributionAmount(address token)`: Get minimum contribution amount and decimals
- `getAllSupportedTokens()`: Get list of all supported tokens

### YieldDistributor

Manages yield distribution between creators and the platform.

**Features:**

- Configurable platform yield share
- Treasury management
- Safe math for yield calculations
- Maximum yield share limits

**Key Functions:**

- `calculateYieldShares(uint256 totalYield)`: Calculate creator and platform shares
- `updatePlatformTreasury(address _platformTreasury)`: Update platform treasury address
- `updatePlatformYieldShare(uint256 _platformYieldShare)`: Update platform's yield share percentage
- `getPlatformTreasury()`: Get current platform treasury address
- `getPlatformYieldShare()`: Get current platform yield share percentage

## System Flow

1. **Campaign Creation**: Creator deploys a campaign via the factory
2. **Contribution**: Users contribute in any supported token
3. **Yield Generation**: Funds earn yield in Aave during the campaign
4. **Campaign Resolution**:
   - If successful: Creator claims funds
   - If unsuccessful: Contributors request refunds
5. **Yield Harvesting**: Yield is harvested and distributed between creator and platform

## Security Features

- Non-reentrant function guards
- Platform admin safety measures with grace periods
- Ownable contracts with access control
- Token validation and safety checks
- Slippage protection for token swaps
- Proper error handling with custom errors

## Dependencies

- OpenZeppelin Contracts (v4.x):
  - Access control
  - SafeERC20
  - ReentrancyGuard
  - Ownable
- Aave (v3) for yield generation
- Uniswap (v3) for token swaps

## Development and Deployment

### Requirements

- Solidity ^0.8.28
- Access to Aave v3 contracts
- Access to Uniswap v3 Router and Quoter
- OpenZeppelin libraries

### Deployment Sequence

1. Deploy `PlatformAdmin`
2. Deploy `TokenRegistry`
3. Deploy `YieldDistributor`
4. Deploy `DefiIntegrationManager`
5. Deploy `CampaignContractFactory`
6. Add supported tokens to `TokenRegistry`

## License

MIT
