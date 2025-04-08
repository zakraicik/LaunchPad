import React, { useState, useEffect, useRef } from 'react'
import { db } from '../utils/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Image from 'next/image'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

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
  disabled?: boolean
}

export default function TokenSelector ({
  selectedToken,
  onTokenSelect,
  className = '',
  disabled = false
}: TokenSelectorProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClickOutside (event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (loading) {
    return (
      <div className={`bg-gray-100 text-gray-500 px-3 py-2 ${className}`}>
        Loading tokens...
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-2 bg-white border-l border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        disabled={disabled}
      >
        {selectedToken ? (
          <div className='flex items-center'>
            <span>{selectedToken}</span>
          </div>
        ) : (
          <span>Select Token</span>
        )}
        <ChevronDownIcon className='h-4 w-4 ml-2' />
      </button>

      {isOpen && !disabled && (
        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
          {tokens.map(token => (
            <button
              key={token.address}
              type='button'
              onClick={() => {
                onTokenSelect(token.address)
                setIsOpen(false)
              }}
              className='flex items-center w-full px-3 py-2 text-left hover:bg-gray-100'
            >
              <div>
                <div className='font-medium'>{token.symbol}</div>
                <div className='text-sm text-gray-500'>{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
