// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'

import IERC20ABI from './test/abis/IERC20ABI.json'

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
    remoteContracts: [
      {
        name: 'USDC',
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        abi: IERC20ABI
      },
      {
        name: 'DAI',
        address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
        abi: IERC20ABI
      }
    ]
  }
}

export default config
