import { useState, useEffect } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/utils/firebase'

interface PlatformAdmin {
  address: string
  isActive: boolean
  lastOperation: 'ADMIN_ADDED' | 'ADMIN_REMOVED' | string
  lastUpdated: string
}

export function usePlatformAdmin() {
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Set up real-time listener for the admins collection
    const unsubscribe = onSnapshot(
      collection(db, 'admins'),
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
  }, [])

  return {
    admins,
    isLoading,
    error
  }
}
