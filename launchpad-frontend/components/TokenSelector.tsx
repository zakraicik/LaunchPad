import { useState, useEffect } from 'react'
import { db } from '../utils/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  isSupported: boolean
}

interface TokenSelectorProps {
  selectedToken: string
  onTokenSelect: (tokenAddress: string) => void
  className?: string
}

export default function TokenSelector ({
  selectedToken,
  onTokenSelect,
  className = ''
}: TokenSelectorProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSupportedTokens () {
      try {
        const tokensRef = collection(db, 'tokens')
        const q = query(tokensRef, where('isSupported', '==', true))
        const querySnapshot = await getDocs(q)

        const supportedTokens = querySnapshot.docs.map(doc => ({
          address: doc.id,
          ...doc.data()
        })) as Token[]

        setTokens(supportedTokens)
      } catch (error) {
        console.error('Error fetching supported tokens:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSupportedTokens()
  }, [])

  if (loading) {
    return (
      <select
        className={`bg-gray-100 text-gray-500 px-3 py-2 ${className}`}
        disabled
      >
        <option>Loading tokens...</option>
      </select>
    )
  }

  return (
    <select
      value={selectedToken}
      onChange={e => onTokenSelect(e.target.value)}
      className={`bg-white border-l border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
    >
      <option value=''>Select Token</option>
      {tokens.map(token => (
        <option key={token.address} value={token.address}>
          {token.address}
        </option>
      ))}
    </select>
  )
}
