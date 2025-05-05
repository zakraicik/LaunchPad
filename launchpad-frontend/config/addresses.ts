// Contract addresses for different networks
export const SUPPORTED_NETWORKS = [84532, 8453] as const
type SupportedNetwork = typeof SUPPORTED_NETWORKS[number]

export const CONTRACT_ADDRESSES: Record<SupportedNetwork, {
  tokenRegistry: string
  campaignFactory: string
  defiManager: string
  platformAdmin: string
  feeManager: string,
  eventCollector: string,
}> = {
  84532: {
    tokenRegistry: '0x83bEF8918f2c00080dD7aB984B7d22CaF28a5826',
    campaignFactory: '0xeC5828af1995430f6a9c870ba34d8c567bF41C7F',
    defiManager: '0xC857a4B4f1df79efe286d76A68B6c9742B3083Cb',
    platformAdmin: '0xDF41aa9f24165a057CD1bFda93Ca0A7F3ACC7f69',
    feeManager: '0x597FD4eBb94f2CeA05260025a5fabcc63F69ED69',
    eventCollector: "0x160322c719deBf43d92d34B0A05C72E4F4be28aa",
  },
  8453: {
    tokenRegistry: "0xb1CF2E7fa0FfF4434BA8fee25639Ae5f61e555E3",
    campaignFactory: "0x1757Bd6c4746A995FddB39c38E2B0019E725f3b1",
    defiManager: "0x0F3159eE738f8cc6a3E256d285e36a5999593d9e",
    platformAdmin: "0x435488929685FA6A2Bd8Ab645Ad1df4355dB9D24",
    feeManager: "0xca21e776f0707aE4D9835b4e4F5a4F23599d37Ef",
    eventCollector: "0xD28e9356b9A9AC2b15c34169DbB82CcCF47702d4",
    
  }
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
