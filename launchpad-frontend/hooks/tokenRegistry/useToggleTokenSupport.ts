import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import TokenRegistry from '../../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json'
import { useState } from 'react'
import { ethers } from 'ethers'
import { useHydration } from '@/pages/_app'

export function useToggleTokenSupport() {
  const { isHydrated } = useHydration()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSupport = async (tokenAddress: string, enable: boolean) => {
    // Early return if not hydrated yet
    if (!isHydrated) {
      setError('Client not yet hydrated')
      return null
    }
    
    try {
      setIsToggling(true)
      setError(null)

      if (!walletClient) {
        throw new Error('Please connect your wallet')
      }

      // Get the provider and signer from Wagmi
      const provider = new ethers.BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()

      // Get the correct contract address for this network
      const registryAddress = getContractAddress(
        (chainId || 84532) as 84532,
        'tokenRegistry'
      )

      // Create contract instance
      const registry = new ethers.Contract(
        registryAddress,
        TokenRegistry.abi,
        signer
      )

      // Call the appropriate function based on enable flag
      const tx = await (enable 
        ? registry.enableTokenSupport(tokenAddress)
        : registry.disableTokenSupport(tokenAddress))

      const receipt = await tx.wait()

      return {
        txHash: receipt.hash
      }
    } catch (err) {
      console.error('Error toggling token support:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle token support'
      setError(errorMessage)
      throw err
    } finally {
      setIsToggling(false)
    }
  }

  return {
    toggleSupport,
    isToggling,
    error,
    isHydrated
  }
} 