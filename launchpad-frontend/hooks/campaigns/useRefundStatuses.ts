import { useMemo } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import { useQueries } from '@tanstack/react-query'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'
import { useHydration } from '../../pages/_app'

interface CampaignContribution {
  campaignId: string
  campaignAddress?: string
  isRefundEligible: boolean
}

const useRefundStatuses = (campaigns: CampaignContribution[], userAddress?: string) => {
  const { isHydrated } = useHydration()
  const { data: walletClient } = useWalletClient()

  // Only include campaigns that we actually need to check
  const campaignsToCheck = useMemo(() => 
    campaigns.filter(c => 
      c.isRefundEligible && c.campaignAddress && userAddress
    ),
    [campaigns, userAddress]
  )

  // More specific query keys
  const queries = useMemo(() => 
    campaignsToCheck.map(campaign => ({
      queryKey: [
        'hasBeenRefunded',
        campaign.campaignId,
        campaign.campaignAddress,
        userAddress,
        'v1' // Add a version if you change the query implementation
      ],
      queryFn: async () => {
        if (!walletClient) return false

        try {
          const provider = new BrowserProvider(walletClient.transport)
          const signer = await provider.getSigner()
          
          const campaignContract = new Contract(
            campaign.campaignAddress as string,
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
      enabled: Boolean(isHydrated && walletClient),
      refetchInterval: 30000,
      staleTime: 20000,
      gcTime: 60000,
      retry: 2,
    })),
    [campaignsToCheck, userAddress, walletClient, isHydrated]
  )

  const refundQueries = useQueries({ queries })

  return useMemo(() => 
    campaigns.reduce<Record<string, boolean>>((acc, campaign, index) => {
      // Find the matching query result
      const queryIndex = campaignsToCheck.findIndex(c => c.campaignId === campaign.campaignId)
      acc[campaign.campaignId] = queryIndex >= 0 ? (refundQueries[queryIndex].data ?? false) : false
      return acc
    }, {}),
    [campaigns, campaignsToCheck, refundQueries]
  )
}

export default useRefundStatuses 