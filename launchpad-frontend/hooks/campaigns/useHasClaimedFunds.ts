import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'

export const useHasClaimedFunds = (campaignAddress?: string) => {
  const { data: walletClient } = useWalletClient()

  const { data: hasClaimed = false, isLoading: isChecking } = useQuery({
    queryKey: ['hasClaimedFunds', campaignAddress],
    queryFn: async () => {
      if (!walletClient || !campaignAddress) return false

      try {
        const provider = new BrowserProvider(walletClient.transport)
        const signer = await provider.getSigner()
        
        // Create campaign contract instance
        const campaignContract = new Contract(
          campaignAddress,
          CampaignABI.abi,
          signer
        )

        // Call hasClaimedFunds function (view function, no transaction)
        return await campaignContract.hasClaimedFunds()
      } catch (error) {
        console.error('Error checking if funds have been claimed:', error)
        return false
      }
    },
    enabled: !!walletClient && !!campaignAddress,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  })

  return { hasClaimed, isChecking }
}