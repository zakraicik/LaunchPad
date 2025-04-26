import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import PlatformAdmin from '../../../artifacts/contracts/PlatformAdmin.sol/PlatformAdmin.json'
import { ethers } from 'ethers'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRemovePlatformAdmin() {
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (adminAddress: string) => {
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
    },
    onSuccess: () => {
      // Invalidate the platform admins query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['platformAdmins', chainId] })
    }
  })

  return {
    removePlatformAdmin: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null
  }
} 