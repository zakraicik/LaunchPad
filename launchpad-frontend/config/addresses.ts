// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Base Sepolia
  84532: {
    tokenRegistry: '0x38ddf2ad02d9d5c8bd237173aae5c438222b4e22',
    campaignFactory: '0x3861f352ef5bf6a188cb654de2893ec768a0e670',
    defiManager: '0x56b236df8f47cc0cf258c477d387ec8bcfe5c170'
  }
  // Add other networks as needed
} as const

// Helper function to get contract address for current network
export function getContractAddress (
  networkId: number,
  contract: keyof (typeof CONTRACT_ADDRESSES)[84532]
) {
  const networkAddresses = CONTRACT_ADDRESSES[networkId]
  if (!networkAddresses) {
    throw new Error(`No contract addresses found for network ${networkId}`)
  }
  return networkAddresses[contract]
}

// For backward compatibility
export const TokenRegistryAddress = CONTRACT_ADDRESSES[84532].tokenRegistry
export const CampaignFactoryAddress = CONTRACT_ADDRESSES[84532].campaignFactory
export const DefiManagerAddress = CONTRACT_ADDRESSES[84532].defiManager
