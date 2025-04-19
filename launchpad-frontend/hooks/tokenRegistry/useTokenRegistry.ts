import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/utils/firebase'

interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  isSupported: boolean
  minimumContribution: string
  lastOperation: 'TOKEN_ADDED' | 'TOKEN_REMOVED' | string
  lastUpdated: string
}

export function useTokenRegistry() {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    // Set up real-time listener for the tokens collection
    const unsubscribe = onSnapshot(
      collection(db, 'tokens'),
      (snapshot) => {
        try {
          const tokenData: TokenInfo[] = snapshot.docs.map(doc => ({
            address: doc.id, // Use document ID as the address
            ...doc.data() as Omit<TokenInfo, 'address'>
          }))
          
          // Sort tokens by lastUpdated date, most recent first
          tokenData.sort((a, b) => 
            new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
          )
          
          setTokens(tokenData)
          setIsLoading(false)
        } catch (err) {
          console.error('Error processing token data:', err)
          setError('Failed to process token data')
          setIsLoading(false)
        }
      },
      (err) => {
        console.error('Error fetching tokens:', err)
        setError('Failed to fetch token data')
        setIsLoading(false)
      }
    )

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [])

  return {
    tokens,
    isLoading,
    error
  }
}
