import { useState, useEffect } from 'react'
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'

interface PlatformAdmin {
  address: string
  isActive: boolean
  lastOperation: 'ADMIN_ADDED' | 'ADMIN_REMOVED' | string
  lastUpdated: string
  networkId: string
}

export function usePlatformAdmin() {
  const chainId = useChainId()
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Ensure chainId is one of our supported networks
    if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
      console.log('Unsupported network, clearing admins')
      setAdmins([])
      setIsLoading(false)
      return
    }

    // Set up real-time listener for the admins collection
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
            address: doc.id, // Use document ID as the address
            ...doc.data() as Omit<PlatformAdmin, 'address'>
          }))
          
          // Sort admins by lastUpdated date, most recent first
          adminData.sort((a, b) => 
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
          )
          
          setAdmins(adminData)
          setIsLoading(false)
        } catch (err) {
          console.error('Error processing admin data:', err)
          setError('Failed to process admin data')
          setIsLoading(false)
        }
      },
      (err) => {
        console.error('Error fetching admins:', err)
        setError('Failed to fetch admin data')
        setIsLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [chainId])

  return {
    admins,
    isLoading,
    error
  }
}
