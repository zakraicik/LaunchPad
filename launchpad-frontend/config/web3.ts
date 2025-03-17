import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'viem'
import { baseSepolia, baseMainnet } from './networks'

export const config = getDefaultConfig({
  appName: 'LaunchPad dApp',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [baseSepolia, baseMainnet],
  transports: {
    [baseSepolia.id]: http(),
    [baseMainnet.id]: http()
  },
  ssr: true // Enable server-side rendering
})

export const { chains, publicClient, webSocketPublicClient } = config
