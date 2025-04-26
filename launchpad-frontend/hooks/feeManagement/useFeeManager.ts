import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'
import { useQuery } from '@tanstack/react-query'

interface FeeSettings {
  lastOperation: string
  lastUpdated: string
  platformFeeShare: number
  treasuryAddress: string
  networkId: string
}

export function useFeeManager() {
  const chainId = useChainId()

  const { data: feeSettings, isLoading, error, refetch } = useQuery({
    queryKey: ['feeSettings', chainId],
    queryFn: async () => {
      if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
        throw new Error('Unsupported network')
      }

      return new Promise<FeeSettings | null>((resolve, reject) => {
        const feeConfigRef = collection(db, 'feeConfig')
        const q = query(feeConfigRef, where('networkId', '==', chainId.toString()))

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            try {
              if (!snapshot.empty) {
                const doc = snapshot.docs[0]
                const data = doc.data() as FeeSettings
                resolve(data)
              } else {
                resolve(null)
              }
            } catch (err) {
              reject(err)
            }
          },
          (err) => {
            reject(err)
          }
        )

        // Cleanup subscription when the query is cancelled
        return () => unsubscribe()
      })
    },
    enabled: SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number]),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
  })

  return {
    feeSettings,
    isLoading,
    error: error as Error | null,
    refetch
  }
}
