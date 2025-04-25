import { useState } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

export const useHasClaimedFunds = () => {
  const { data: walletClient } = useWalletClient()
  const [isChecking, setIsChecking] = useState(false)

  const hasClaimedFunds = async (campaignAddress: string) => {
    if (!walletClient || !campaignAddress) {
      toast.error('Please connect your wallet')
      return false
    }

    setIsChecking(true)
    let toastId = toast.loading('Checking if funds have been claimed...')

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
      const hasClaimedResult = await campaignContract.hasClaimedFunds()
      
      toast.dismiss(toastId)
      return hasClaimedResult
    } catch (error: any) {
      console.error('Error checking if funds have been claimed:', error)
      toast.dismiss(toastId)
      // Don't show toast for user rejections
      if (error.code !== 'ACTION_REJECTED') {
        toast.error(error.message || 'Failed to check claim status')
      }
      return false
    } finally {
      setIsChecking(false)
    }
  }

  return { hasClaimedFunds, isChecking }
}