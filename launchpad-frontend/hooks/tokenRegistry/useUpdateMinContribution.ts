import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import TokenRegistry from '../../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json'
import { useState } from 'react'
import { ethers } from 'ethers'
import { type Abi } from 'viem'

export function useUpdateMinContribution() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateMinContribution = async (tokenAddress: string, minAmount: string) => {
    try {
      setIsUpdating(true)
      setError(null)

      if (!walletClient) {
        throw new Error('Please connect your wallet')
      }

      const provider = new ethers.BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()

      const registryAddress = getContractAddress(
        (chainId || 84532) as 84532,
        'tokenRegistry'
      )

      const registry = new ethers.Contract(
        registryAddress,
        TokenRegistry.abi,
        signer
      )

      const tx = await registry.updateTokenMinimumContribution(tokenAddress, minAmount)
      const receipt = await tx.wait()

      return {
        txHash: receipt.hash
      }
    } catch (err) {
      console.error('Error updating minimum contribution:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update minimum contribution'
      setError(errorMessage)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    updateMinContribution,
    isUpdating,
    error
  }
} 