import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import FeeManager from '../../../artifacts/contracts/FeeManager.sol/FeeManager.json'
import { useState } from 'react'
import { ethers } from 'ethers'

export function useUpdatePlatformFeeShare() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updatePlatformFeeShare = async (feeShare: number) => {
    try {
      setIsUpdating(true)
      setError(null)

      if (!walletClient) {
        throw new Error('Please connect your wallet')
      }

      // Get the provider and signer from Wagmi
      const provider = new ethers.BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()

      // Get the correct contract address for this network
      const feeManagerAddress = getContractAddress(
        (chainId || 84532) as 84532,
        'feeManager'
      )

      // Create contract instance
      const feeManager = new ethers.Contract(
        feeManagerAddress,
        FeeManager.abi,
        signer
      )

      // Call the addToken function
      const tx = await feeManager.updatePlatformFeeShare(
        feeShare
      )

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      return {
        txHash: receipt.hash
      }
    } catch (err) {
      console.error('Error adding platform admin:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add platform admin'
      setError(errorMessage)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    updatePlatformFeeShare,
    isUpdating,
    error
  }
} 