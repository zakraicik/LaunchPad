import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import TokenRegistry from '../../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json'
import { useState } from 'react'
import { ethers } from 'ethers'

export function useRemoveToken() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removeToken = async (tokenAddress: string) => {
    try {
    setIsRemoving(true)
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

      // Call the addToken function
      const tx = await registry.removeToken(
        tokenAddress
      )

      const receipt = await tx.wait()

      return {
        txHash: receipt.hash
      }
    } catch (err) {
      console.error('Error removing token:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove token'
      setError(errorMessage)
      throw err
    } finally {
        setIsRemoving(false)
    }
  }

  return {
    removeToken,
    isRemoving,
    error
  }
} 