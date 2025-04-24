import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import DefiIntegrationManager from '../../../artifacts/contracts/DefiIntegrationManager.sol/DefiIntegrationManager.json'
import { useState } from 'react'
import { ethers } from 'ethers'

export function useUpdatePlatformFeeShare() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getATokenAddress = async (token: string) => {
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
      const defiIntegrationManagerAddress = getContractAddress(
        (chainId || 84532) as 84532,
        'defiManager'
      )

      // Create contract instance
      const defiIntegrationManager = new ethers.Contract(
        defiIntegrationManagerAddress,
        DefiIntegrationManager.abi,
        signer
      )

      // Call the addToken function
      const tx = await defiIntegrationManager.getATokenAddress(
        token
      )

      return tx     
    //   return {
    //     txHash: receipt.hash
    //   }
    } catch (err) {
      console.error('Error getting aToken address:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to get aToken address'
      setError(errorMessage)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    getATokenAddress,
    isUpdating,
    error
  }
} 