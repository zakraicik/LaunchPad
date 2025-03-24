# Crowdfunding Platform Integration Tests

This document outlines comprehensive integration tests for the blockchain crowdfunding platform with automatic yield-generating capabilities.

## Hardhat Configuration

We're using Hardhat with a forked Base mainnet for our integration tests. This allows us to interact with real DeFi protocols without deploying to production.

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'

import IERC20ABI from './test/abis/IERC20ABI.json'
import UniswapQuoterABI from './test/abis/UniswapQuoter.json'
import UniswapRouterABI from './test/abis/UniswapRouter.json'
import AavePoolABI from './test/abis/AAVEPool.json'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: 'https://base-mainnet.g.alchemy.com/v2/A8wE4FsZsP3eTlR0DSDh3w5nU7wdPyUG',
        blockNumber: 27890280 // Use a recent block number
      },
      chains: {
        8453: {
          hardforkHistory: {
            shanghai: 0, // Base launched with Shanghai already active
            cancun: 5691340 // Base's Cancun upgrade block
          }
        }
      }
    },
    baseSepolia: {
      url: 'https://sepolia.base.org',
      chainId: 84532
    }
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    remoteContracts: [
      {
        name: 'USDC',
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        abi: IERC20ABI
      },
      {
        name: 'WBTC',
        address: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
        abi: IERC20ABI
      },
      {
        name: 'AAVE',
        address: '0xa238dd80c259a72e81d7e4664a9801593f98d1c5',
        abi: AavePoolABI
      }
    ]
  }
}

export default config
```

### Key Configuration Details:

1. **Solidity Version**: 0.8.28 with optimization enabled
2. **Network Forking**: Tests run against a forked Base mainnet with block 27890280
3. **Gas Reporter**: Tracks gas usage for optimizing contract deployment and functions
4. **Remote Contracts**: Includes configuration for real tokens and protocols on Base

## 1. Campaign Lifecycle Tests

Tests to verify the complete flow of campaign creation, funding, and completion.

### Campaign Creation

- ✅ Create campaign through factory with valid parameters
- ✅ Verify campaign initialization with correct parameters (token, goal, duration)

### Contribution Process

- ✅ Contribute with campaign token (auto-deposits to yield protocol)
- ✅ Verify contributions update campaign total raised amount
- ✅ Verify contributor count increases correctly
- ✅ Verify aToken balances in the campaign contract
- ✅ Verify deposit records in DefiIntegrationManager
- ✅ Test multiple contributors to a single campaign

### Campaign Completion (Success)

- ✅ End campaign with goal achieved
- ✅ Owner claims funds after successful campaign
- ✅ Verify platform fee is distributed correctly
- ✅ Verify funds can only be claimed once

### Campaign Completion (Failure)

- ✅ End campaign without reaching goal
- ✅ Contributors request refunds
- ✅ Verify refund amount matches contribution
- ✅ Verify platform only takes fee from yield, not principal on failed campaigns
- ✅ Attempt double refund (should fail)

## 2. Token Integration Tests

Tests focused on token functionality and interactions.

### Token Registry

- ✅ Add new token to registry with minimum contribution
- ✅ Remove token from registry
- ✅ Disable token support temporarily
- ✅ Re-enable token support
- Update token minimum contribution

### Token Error Handling

- ✅ Test contribution with unsupported token (should fail)
- ✅ Test with insufficient allowance (should fail)
- ✅ Verify zero-amount operations are rejected

## 3. DeFi Integration Tests

Tests for interactions with external DeFi protocols.

### Aave Integration

- ✅ Test automatic deposit to Aave during contribution
- ✅ Test complete withdrawal from Aave during fund claim
- ✅ Verify yield accumulation over time
- Test handling of yield rate changes
- Verify response to liquidity constraints

### Yield Distribution

- ✅ Test platform fee calculation with successful campaigns
- ✅ Test platform fee calculation with failed campaigns
- ✅ Verify fee distribution to treasury during withdrawal
- Test updating platform fee percentage

## 4. Admin Control Tests

Tests for administrative functions and controls.

### Platform Admin Access

- Test admin access control validation
- Add new platform admin
- Remove platform admin
- Test non-admin restricted function access (should fail)

### Grace Period Mechanics

- Test grace period calculation
- Admin intervention before grace period (should fail)
- Admin intervention after grace period
- Update grace period length

### Admin Override Functions

- Test admin campaign override flag
- Test admin funds claim functionality
- Test emergency fund withdrawal by admin

## 5. Edge Cases and Recovery Tests

Testing resilience and handling of exceptional conditions.

### Gas Optimization

- Verify gas usage for large contributor counts
- Test gas efficiency of key operations (contribution, fund claiming)
- Compare gas costs before and after optimizations

### Error Recovery

- Test admin intervention after owner abandonment
- Test with failing external contracts
- Verify graceful handling of reverted transactions

### Security Scenarios

- Test reentrancy protection
- Verify access control in critical functions
- Test with malicious input data
- Verify funds safety across different yield accumulation scenarios

## Running the Tests

With our Hardhat configuration, we can run the tests using:

```bash
# Run all tests
npx hardhat test

# Run a specific test file
npx hardhat test ./test/integration/Campaign.test.ts
```

### Tips for Test Performance

1. **Use specific block numbers** in the forking configuration to ensure consistent test results
2. **Cache fork states** for faster test runs when the initial state is the same
3. **Toggle between mocks and real contracts** depending on the test's requirements
4. **Use tags to categorize tests** for selective running (`describe.skip`, `it.only`, etc.)
5. **Create reusable fixtures** with hardhat-fixture plugin to speed up tests

By implementing these tests, you'll have comprehensive coverage of your crowdfunding platform's functionality and edge cases, reflecting the simplified design with automatic yield generation.
