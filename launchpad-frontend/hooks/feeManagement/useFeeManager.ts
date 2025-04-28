import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'
import { useQuery } from '@tanstack/react-query'
import { useHydration } from '@/pages/_app'

interface FeeSettings {
  lastOperation: string
  lastUpdated: string
  platformFeeShare: number
  treasuryAddress: string
  networkId: string
}

export function useFeeManager() {
  const { isHydrated } = useHydration()
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
    // Only enable query when both supported network AND component is hydrated
    enabled: SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number]) && isHydrated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    feeSettings,
    isLoading,
    error: error as Error | null,
    refetch,
    isHydrated
  }
}
