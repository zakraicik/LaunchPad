import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

const useHasBeenRefunded = (campaignAddress?: string, userAddress?: string) => {
  const { data: walletClient } = useWalletClient()

  return useQuery({
    queryKey: ['hasBeenRefunded', campaignAddress, userAddress],
    queryFn: async () => {
      if (!walletClient || !campaignAddress || !userAddress) {
        return false
      }

      try {
        const provider = new BrowserProvider(walletClient.transport)
        const signer = await provider.getSigner()
        
        const campaignContract = new Contract(
          campaignAddress,
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
    enabled: Boolean(walletClient && campaignAddress && userAddress),
    refetchInterval: 10000,
    staleTime: 5000,
    gcTime: 30000,
    retry: 2,
  })
}

export default useHasBeenRefunded 