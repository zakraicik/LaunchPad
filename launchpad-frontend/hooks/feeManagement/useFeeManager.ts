import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/utils/firebase'

interface FeeSettings {
  lastOperation: string
  lastUpdated: string
  platformFeeShare: number
  treasuryAddress: string
}

export function useFeeManager() {
  const [feeSettings, setFeeSettings] = useState<FeeSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Set up real-time listener for the 'current' document in fees collection
    const unsubscribe = onSnapshot(
      doc(db, 'feeConfig', 'current'),
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data() as FeeSettings
            setFeeSettings(data)
          } else {
            setError('Fee settings not found')
          }
          setIsLoading(false)
        } catch (err) {
          console.error('Error processing fee data:', err)
          setError('Failed to process fee data')
          setIsLoading(false)
        }
      },
      (err) => {
        console.error('Error fetching fee settings:', err)
        setError('Failed to fetch fee settings')
        setIsLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [])

  return {
    feeSettings,
    isLoading,
    error
  }
}
