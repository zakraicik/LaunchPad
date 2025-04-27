import { useState } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

export const useIsContributor = () => {
  const { data: walletClient } = useWalletClient()
  const [isCheckingContributor, setIsCheckingContributor] = useState(false)

  const checkIsContributor = async (campaignAddress: string, walletAddress: string) => {
    if (!walletClient || !campaignAddress) {
      toast.error('Please connect your wallet')
      return
    }

    setIsCheckingContributor(true)
    let toastId = toast.loading('Initiating refund request...')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      
      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CampaignABI.abi,
        signer
      )

      // Call requestRefund function
      const tx = await campaignContract.isContributor(walletAddress)
      toast.dismiss(toastId)
      toastId = toast.loading('Transaction sent. Waiting for confirmation...')

      toast.dismiss(toastId)
      toast.success('Checking if contributor!')

      return tx
    } catch (error: any) {
      console.error('Error checking if contributor:', error)
      toast.dismiss(toastId)
      // Don't show toast for user rejections
      if (error.code !== 'ACTION_REJECTED') {
        toast.error(error.message || 'Failed to check if contributor')
      }
      throw error
    } finally {
        setIsCheckingContributor(false)
    }
  }

  return { checkIsContributor, isCheckingContributor }
}
