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
    tokenRegistry: '0x38ddf2ad02d9d5c8bd237173aae5c438222b4e22',
    campaignFactory: '0x3861f352ef5bf6a188cb654de2893ec768a0e670',
    defiManager: '0x56b236df8f47cc0cf258c477d387ec8bcfe5c170',
    platformAdmin: '0xB79BD073759FF71396C747362957255475F91bA7'
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
