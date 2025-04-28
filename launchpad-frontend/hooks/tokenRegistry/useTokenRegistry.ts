import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/utils/firebase'
import { useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '@/config/addresses'
import { useHydration } from '@/pages/_app'

interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  isSupported: boolean
  minimumContribution: string
  lastOperation: 'TOKEN_ADDED' | 'TOKEN_REMOVED' | string
  lastUpdated: string
  networkId: string
}

export function useTokenRegistry() {
  const { isHydrated } = useHydration()
  const chainId = useChainId()
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Skip effect entirely if not hydrated
    if (!isHydrated) return
    
    // Move these inside the effect so they only run after hydration
    setIsLoading(true)
    setError(null)

    // Ensure chainId is one of our supported networks
    if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
      console.log('Unsupported network, clearing tokens')
      setTokens([])
      setIsLoading(false)
      return
    }

    // Set up real-time listener for the tokens collection
    const tokensRef = collection(db, 'tokens')
    const q = query(tokensRef, where('networkId', '==', chainId.toString()))

    const unsubscribe = onSnapshot(
      q,
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
  }, [chainId, isHydrated])

  return {
    tokens,
    isLoading,
    error,
    isHydrated
  }
}
