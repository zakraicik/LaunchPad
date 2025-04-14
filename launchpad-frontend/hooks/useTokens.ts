import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../utils/firebase'

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

// Hardcoded token mappings for known tokens
const TOKEN_MAPPINGS: { [address: string]: Partial<Token> } = {
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  }
}

export function useTokens () {
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const tokensCollection = collection(db, 'tokens')
        const snapshot = await getDocs(tokensCollection)
        const tokensData = snapshot.docs.map(doc => {
          const address = doc.id
          const data = doc.data()
          // Merge Firebase data with hardcoded mapping if it exists
          const mappedData = TOKEN_MAPPINGS[address.toLowerCase()]
          return {
            ...data,
            ...mappedData,
            address
          }
        }) as Token[]
        setTokens(tokensData)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTokens()
  }, [])

  const getTokenByAddress = (address: string) => {
    const token = tokens.find(
      token => token.address.toLowerCase() === address.toLowerCase()
    )
    if (token) return token

    // Return hardcoded mapping if token not found in Firebase
    const mappedToken = TOKEN_MAPPINGS[address.toLowerCase()]
    if (mappedToken) {
      return {
        ...mappedToken,
        address
      } as Token
    }
    return null
  }

  return {
    tokens,
    isLoading,
    error,
    getTokenByAddress
  }
}
