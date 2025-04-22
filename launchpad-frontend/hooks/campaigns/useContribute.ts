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
    const toastId = toast.loading('Contributing funds...')

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
      toast.loading('Waiting for confirmation...', { id: toastId })

      await tx.wait()

      toast.success('Contribution successful!', { id: toastId })
      return tx.hash
    } catch (error: any) {
      console.error('Error contributing funds:', error)
      toast.error(error, { id: toastId })
      throw error
    } finally {
      setIsContributing(false)
    }
  }

  return { contribute, isContributing }
}
