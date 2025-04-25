import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../utils/firebase'
import { useChainId } from 'wagmi'

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

const fetchTokens = async (): Promise<Token[]> => {
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
    return tokensData
  } catch (error) {
    console.error('Error fetching tokens:', error)
    return []
  }
}

export function useTokens() {
  const chainId = useChainId()

  const queryOptions: UseQueryOptions<Token[], Error, Token[], [string, number]> = {
    queryKey: ['tokens', chainId],
    queryFn: fetchTokens,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000
  }

  const { data: tokens = [], isLoading } = useQuery(queryOptions)

  const getTokenByAddress = (address: string): Token | null => {
    if (!address) return null

    // First check hardcoded mappings
    const mappedToken = TOKEN_MAPPINGS[address.toLowerCase()]
    if (mappedToken) {
      return {
        ...mappedToken,
        address
      } as Token
    }

    // Then check fetched tokens
    const token = tokens.find(
      (token: Token) => token.address.toLowerCase() === address.toLowerCase()
    )
    if (token) return token

    return null
  }

  return {
    tokens,
    isLoading,
    getTokenByAddress
  }
}
