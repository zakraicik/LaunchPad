import { useState } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

export const useContribute = () => {
  const { data: walletClient } = useWalletClient()
  const [isContributing, setIsContributing] = useState(false)

  const contribute = async (campaignAddress: string, amount: bigint) => {
    if (!walletClient || !campaignAddress) {
      toast.error('Please connect your wallet')
      return
    }

    setIsContributing(true)
    let toastId = toast.loading('Initiating contribution...')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      
      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CampaignABI.abi,
        signer
      )

      // Call contribute function
      const tx = await campaignContract.contribute(amount, {gasLimit: 1000000})
      toast.dismiss(toastId)
      toastId = toast.loading('Transaction sent. Waiting for confirmation...')

      await tx.wait()

      toast.dismiss(toastId)
      toast.success('Contribution successful!')
      return tx.hash
    } catch (error: any) {
      console.error('Error contributing funds:', error)
      toast.dismiss(toastId)
      // Don't show toast for user rejections
      if (error.code !== 'ACTION_REJECTED') {
        toast.error(error.message || 'Failed to contribute')
      }
      throw error
    } finally {
      setIsContributing(false)
    }
  }

  return { contribute, isContributing }
}
