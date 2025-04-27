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

  const refundQueries = useQueries({
    queries: campaigns.map(campaign => ({
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
      refetchInterval: 10000,
      staleTime: 5000,
      gcTime: 30000,
      retry: 2,
    }))
  })

  // Convert the array of query results into a map of campaignId -> refund status
  return campaigns.reduce<Record<string, boolean>>((acc, campaign, index) => {
    acc[campaign.campaignId] = refundQueries[index].data ?? false
    return acc
  }, {})
}

export default useRefundStatuses 