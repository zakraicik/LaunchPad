import { useMemo } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import { useQueries } from '@tanstack/react-query'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'
import { useHydration } from '../../pages/_app'

interface CampaignCheck {
  campaignId: string
  campaignAddress?: string
}

export const useIsContributor = (campaigns: CampaignCheck[], userAddress?: string) => {
  const { isHydrated } = useHydration()
  const { data: walletClient } = useWalletClient()

  // Memoize the queries configuration
  const queries = useMemo(() => 
    campaigns.map(campaign => ({
      queryKey: ['isContributor', campaign.campaignId, campaign.campaignAddress, userAddress],
      queryFn: async () => {
        if (!walletClient || !campaign.campaignAddress || !userAddress) {
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

          return await campaignContract.isContributor(userAddress)
        } catch (error: any) {
          console.error('Error checking if contributor:', error)
          if (error.code !== 'ACTION_REJECTED') {
            toast.error(error.message || 'Failed to check if contributor')
          }
          return false
        }
      },
      // Add isHydrated to enabled condition
      enabled: Boolean(
        isHydrated &&
        walletClient && 
        campaign.campaignAddress && 
        userAddress
      ),
      refetchInterval: 30000,
      staleTime: 20000,
      gcTime: 60000,
      retry: 2,
    })),
    [campaigns, userAddress, walletClient, isHydrated]
  )

  const contributorQueries = useQueries({ queries })

  // Memoize the final result to prevent unnecessary object creation
  return useMemo(() => 
    campaigns.reduce<Record<string, boolean>>((acc, campaign, index) => {
      acc[campaign.campaignId] = contributorQueries[index].data ?? false
      return acc
    }, {}),
    [campaigns, contributorQueries]
  )
}
