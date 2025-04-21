import { useState } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

export const useClaimFunds = () => {
  const [isClaiming, setIsClaiming] = useState(false)
  const { data: walletClient } = useWalletClient()

  const claimFunds = async (campaignAddress: string) => {
    if (!walletClient || !campaignAddress) {
      toast.error('Please connect your wallet')
      return
    }

    setIsClaiming(true)
    const toastId = toast.loading('Claiming funds...')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      
      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CampaignABI.abi,
        signer
      )

      // Call claimFunds function
      const tx = await campaignContract.claimFunds()
      toast.loading('Waiting for confirmation...', { id: toastId })

      // Wait for transaction confirmation
      await tx.wait()

      toast.success('Funds claimed successfully!', { id: toastId })
      return tx.hash
    } catch (error: any) {
      console.error('Error claiming funds:', error)
      
      let errorMessage = 'Failed to claim funds'
      if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled'
      } else {
        errorMessage = error.message || 'Failed to claim funds'
      }
      
      toast.error(errorMessage, { id: toastId })
      throw error
    } finally {
      setIsClaiming(false)
    }
  }

  return {
    claimFunds,
    isClaiming
  }
}
