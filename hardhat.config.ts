// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-gas-reporter'
import "@nomicfoundation/hardhat-verify";

import * as dotenv from 'dotenv'

dotenv.config()

import IERC20ABI from './test/abis/IERC20ABI.json'
import AavePoolABI from './test/abis/AAVEPool.json'

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

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
        url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
        blockNumber: 29502862 // Use a recent block number
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
      url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    baseMainnet: {
      url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 8453,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  sourcify: {
    enabled: true
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
