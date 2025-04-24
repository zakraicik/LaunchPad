import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import PlatformAdmin from '../../../artifacts/contracts/PlatformAdmin.sol/PlatformAdmin.json'
import { useState } from 'react'
import { ethers } from 'ethers'

export function useRemovePlatformAdmin() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removePlatformAdmin = async (adminAddress: string) => {
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
      const platformAdminAddress = getContractAddress(
        (chainId || 84532) as 84532,
        'platformAdmin'
      )

      // Create contract instance
      const platformAdmin = new ethers.Contract(
        platformAdminAddress,
        PlatformAdmin.abi,
        signer
      )

      // Call the removePlatformAdmin function
      const tx = await platformAdmin.removePlatformAdmin(
        adminAddress, {gasLimit: 1000000}
      )

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      return {
        txHash: receipt.hash
      }
    } catch (err) {
      console.error('Error removing platform admin:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove platform admin'
      setError(errorMessage)
      throw err
    } finally {
      setIsRemoving(false)
    }
  }

  return {
    removePlatformAdmin,
    isRemoving,
    error
  }
} 