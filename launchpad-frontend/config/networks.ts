import { type Chain } from 'viem'

export const baseSepolia: Chain = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Ether',
    symbol: 'ETH'
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org']
    },
    public: {
      http: ['https://sepolia.base.org']
    }
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org'
    }
  },
  testnet: true
}

export const baseMainnet: Chain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH'
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org']
    },
    public: {
      http: ['https://mainnet.base.org']
    }
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://basescan.org'
    }
  },
  testnet: false
}
