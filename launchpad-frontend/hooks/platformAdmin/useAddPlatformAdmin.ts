import { useWalletClient, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import PlatformAdmin from '../../../artifacts/contracts/PlatformAdmin.sol/PlatformAdmin.json'
import { ethers } from 'ethers'
import { collection, doc, setDoc } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useAddPlatformAdmin() {
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

      // Call the addToken function
      const tx = await platformAdmin.addPlatformAdmin(
        adminAddress, {gasLimit: 1000000}
      )

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      // Create/update admin record in Firebase with networkId
      const adminRef = doc(collection(db, 'admins'), adminAddress.toLowerCase())
      await setDoc(adminRef, {
        networkId: chainId.toString(),
        isActive: true,
        lastOperation: 'ADMIN_ADDED',
        lastUpdated: new Date().toISOString()
      }, { merge: true })

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
    addPlatformAdmin: mutation.mutateAsync,
    isAdding: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null
  }
} 