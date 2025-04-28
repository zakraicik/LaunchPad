import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'
import { useQuery } from '@tanstack/react-query'
import { useHydration } from '@/pages/_app'

interface PlatformAdmin {
  address: string
  isActive: boolean
  lastOperation: 'ADMIN_ADDED' | 'ADMIN_REMOVED' | string
  lastUpdated: string
  networkId: string
}

export function usePlatformAdmin() {
  const { isHydrated } = useHydration()
  const chainId = useChainId()

  const { data: admins = [], isLoading, error, refetch } = useQuery({
    queryKey: ['platformAdmins', chainId],
    queryFn: () => {
      if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
        console.log('Unsupported network, returning empty array')
        return []
      }

      return new Promise<PlatformAdmin[]>((resolve, reject) => {
        const adminsRef = collection(db, 'admins')
        const q = query(
          adminsRef, 
          where('networkId', '==', chainId.toString()),
          where('isActive', '==', true)
        )

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            try {
              const adminData: PlatformAdmin[] = snapshot.docs.map(doc => ({
                address: doc.id,
                ...doc.data() as Omit<PlatformAdmin, 'address'>
              }))
              
              // Sort admins by lastUpdated date, most recent first
              adminData.sort((a, b) => 
                new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
              )
              
              resolve(adminData)
            } catch (err) {
              console.error('Error processing admin data:', err)
              reject(new Error('Failed to process admin data'))
            }
          },
          (err) => {
            console.error('Error fetching admins:', err)
            reject(new Error('Failed to fetch admin data'))
          }
        )

        // Cleanup subscription when the query is cancelled
        return () => unsubscribe()
      })
    },
    // Only enable query when both network is supported AND component is hydrated
    enabled: SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number]) && isHydrated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    admins,
    isLoading,
    error: error as Error | null,
    refetch,
    isHydrated
  }
}
