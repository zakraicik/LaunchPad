import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'

interface FeeSettings {
  lastOperation: string
  lastUpdated: string
  platformFeeShare: number
  treasuryAddress: string
  networkId: string
}

export function useFeeManager() {
  const chainId = useChainId()
  const [feeSettings, setFeeSettings] = useState<FeeSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Ensure chainId is one of our supported networks
    if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
      console.log('Unsupported network, clearing fee settings')
      setFeeSettings(null)
      setIsLoading(false)
      return
    }

    // Set up real-time listener for the fee settings
    const feeConfigRef = collection(db, 'feeConfig')
    const q = query(feeConfigRef, where('networkId', '==', chainId.toString()))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          if (!snapshot.empty) {
            // Get the first document (should only be one per network)
            const doc = snapshot.docs[0]
            const data = doc.data() as FeeSettings
            setFeeSettings(data)
          } else {
            setError('Fee settings not found for this network')
            setFeeSettings(null)
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
  }, [chainId])

  return {
    feeSettings,
    isLoading,
    error
  }
}
