// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'

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
        blockNumber: 27769750 // Use a recent block number
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
    gasPrice: 21
  }
}

export default config
