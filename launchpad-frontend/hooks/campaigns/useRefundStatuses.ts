import { useMemo } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import { useQueries } from '@tanstack/react-query'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

interface CampaignContribution {
  campaignId: string
  campaignAddress?: string
  isRefundEligible: boolean
}

const useRefundStatuses = (campaigns: CampaignContribution[], userAddress?: string) => {
  const { data: walletClient } = useWalletClient()

  // Memoize the queries configuration to prevent unnecessary query updates
  const queries = useMemo(() => 
    campaigns.map(campaign => ({
      queryKey: ['hasBeenRefunded', campaign.campaignId, campaign.campaignAddress, userAddress],
      queryFn: async () => {
        if (!walletClient || !campaign.campaignAddress || !userAddress || !campaign.isRefundEligible) {
          return false
        }

        try {
          const provider = new BrowserProvider(walletClient.transport)
          const signer = await provider.getSigner()
          
          const campaignContract = new Contract(
            campaign.campaignAddress,
            CampaignABI.abi,
            signer
          )

          return await campaignContract.hasBeenRefunded(userAddress)
        } catch (error: any) {
          console.error('Error checking if contributor has been refunded:', error)
          if (error.code !== 'ACTION_REJECTED') {
            toast.error(error.message || 'Failed to check if contributor has been refunded')
          }
          return false
        }
      },
      enabled: Boolean(
        walletClient && 
        campaign.campaignAddress && 
        userAddress && 
        campaign.isRefundEligible
      ),
      refetchInterval: 30000, // Increased to 30 seconds
      staleTime: 20000, // Increased to 20 seconds
      gcTime: 60000, // Increased to 1 minute
      retry: 2,
    })),
    [campaigns, userAddress, walletClient]
  )

  const refundQueries = useQueries({ queries })

  // Memoize the final result to prevent unnecessary object creation
  return useMemo(() => 
    campaigns.reduce<Record<string, boolean>>((acc, campaign, index) => {
      acc[campaign.campaignId] = refundQueries[index].data ?? false
      return acc
    }, {}),
    [campaigns, refundQueries]
  )
}

export default useRefundStatuses 