// Contract addresses for different networks
export const SUPPORTED_NETWORKS = [84532] as const
type SupportedNetwork = typeof SUPPORTED_NETWORKS[number]

export const CONTRACT_ADDRESSES: Record<SupportedNetwork, {
  tokenRegistry: string
  campaignFactory: string
  defiManager: string
  platformAdmin: string
}> = {
  84532: {
    tokenRegistry: '0x83bEF8918f2c00080dD7aB984B7d22CaF28a5826',
    campaignFactory: '0xeC5828af1995430f6a9c870ba34d8c567bF41C7F',
    defiManager: '0xC857a4B4f1df79efe286d76A68B6c9742B3083Cb',
    platformAdmin: '0xDF41aa9f24165a057CD1bFda93Ca0A7F3ACC7f69'
  }
  // Add other networks as needed
} as const

// Helper function to get contract address for current network
export function getContractAddress (
  networkId: SupportedNetwork,
  contract: keyof (typeof CONTRACT_ADDRESSES)[typeof SUPPORTED_NETWORKS[0]]
) {
  const networkAddresses = CONTRACT_ADDRESSES[networkId]
  if (!networkAddresses) {
    throw new Error(`No contract addresses found for network ${networkId}`)
  }
  return networkAddresses[contract]
}
