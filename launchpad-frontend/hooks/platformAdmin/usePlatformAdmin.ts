import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'
import { useQuery } from '@tanstack/react-query'

interface PlatformAdmin {
  address: string
  isActive: boolean
  lastOperation: 'ADMIN_ADDED' | 'ADMIN_REMOVED' | string
  lastUpdated: string
  networkId: string
}

export function usePlatformAdmin() {
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
    enabled: SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number]),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
  })

  return {
    admins,
    isLoading,
    error: error as Error | null,
    refetch
  }
}
