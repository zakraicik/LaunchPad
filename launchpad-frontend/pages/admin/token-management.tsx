import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useTokenRegistry } from '../../hooks/useTokenRegistry'
import { useAddToken } from '../../hooks/useAddToken'
import { useState, useEffect, useRef } from 'react'
import { collection, doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { useAccount, useWriteContract, useChainId } from 'wagmi'
import { useIsAdmin } from '../../utils/admin'
import { getContractAddress } from '../../config/addresses'
import TokenRegistry from '../../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json'
import { type Abi } from 'viem'
import toast from 'react-hot-toast'

interface TokenInfo {
  address: string
  name: string
  symbol: string
  isSupported: boolean
  minAmount: string
  decimals: number
  customSymbol?: string
}

export default function TokenManagement() {
  const { tokens } = useTokenRegistry()
  const { address } = useAccount()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address)
  const { addToken, isAdding, error } = useAddToken()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [customSymbol, setCustomSymbol] = useState('')
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({})
  const [newTokenAddress, setNewTokenAddress] = useState('')
  const [minContribution, setMinContribution] = useState('')
  const [addTokenError, setAddTokenError] = useState<string | null>(null)
  const hasFetchedSymbols = useRef(false)
  const chainId = useChainId()

  const { writeContract, isPending, isError: writeContractError } = useWriteContract()

  // Fetch custom symbols from Firestore
  useEffect(() => {
    const fetchCustomSymbols = async () => {
      if (!tokens || hasFetchedSymbols.current) return

      try {
        const symbols: Record<string, string> = {}
        for (const token of tokens) {
          const tokenRef = doc(collection(db, 'tokens'), token.address.toLowerCase())
          const tokenDoc = await getDoc(tokenRef)
          if (tokenDoc.exists() && tokenDoc.data().symbol) {
            symbols[token.address.toLowerCase()] = tokenDoc.data().symbol
          }
        }
        setTokenSymbols(symbols)
        hasFetchedSymbols.current = true
      } catch (error) {
        console.error('Error fetching custom symbols:', error)
      }
    }

    fetchCustomSymbols()
  }, [tokens])

  const handleEditClick = (token: TokenInfo) => {
    if (!isAdmin) return
    setSelectedToken(token)
    setCustomSymbol(tokenSymbols[token.address.toLowerCase()] || token.symbol)
    setIsEditModalOpen(true)
  }

  const handleSaveSymbol = async () => {
    if (!selectedToken || !isAdmin) return

    try {
      const tokenRef = doc(collection(db, 'tokens'), selectedToken.address.toLowerCase())
      await setDoc(tokenRef, {
        symbol: customSymbol
      }, { merge: true })

      // Update local state
      setTokenSymbols(prev => ({
        ...prev,
        [selectedToken.address.toLowerCase()]: customSymbol
      }))

      setIsEditModalOpen(false)
      setSelectedToken(null)
      setCustomSymbol('')
    } catch (error) {
      console.error('Error saving symbol:', error)
    }
  }

  const handleAddToken = async () => {
    if (!isAdmin || !newTokenAddress || !minContribution) return

    const toastId = toast.loading('Adding token...')
    try {
      setAddTokenError(null)
      const { txHash } = await addToken(newTokenAddress, minContribution)
      toast.success('Token added successfully!', { id: toastId })
      setIsAddModalOpen(false)
      setNewTokenAddress('')
      setMinContribution('')
    } catch (error) {
      console.error('Error adding token:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add token'
      setAddTokenError(errorMessage)
      toast.error(errorMessage, { id: toastId })
    }
  }

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Token Management</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2'
        >
          <PlusIcon className='h-5 w-5' />
          Add Token
        </button>
      </div>

      <div className='bg-white rounded-lg shadow'>
        <table className='min-w-full'>
          <thead>
            <tr className='border-b'>
              <th className='px-6 py-3 text-left text-sm font-semibold'>Address</th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>Symbol</th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>Status</th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>Min Amount</th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens?.map(token => (
              <tr key={token.address} className='border-b'>
                <td className='px-6 py-4'>{token.address}</td>
                <td className='px-6 py-4'>
                  <div className="flex items-center gap-2">
                    {tokenSymbols[token.address.toLowerCase()] || token.symbol || 'No symbol set'}
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditClick(token)}
                        className='text-blue-600 hover:text-blue-800'
                      >
                        <PencilIcon className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </td>
                <td className='px-6 py-4'>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    token.isSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {token.isSupported ? 'Supported' : 'Not Supported'}
                  </span>
                </td>
                <td className='px-6 py-4'>{token.minAmount}</td>
                <td className='px-6 py-4'>
                  <button className='text-red-600 hover:text-red-800'>
                    <TrashIcon className='h-5 w-5' />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium mb-4">Edit Token Symbol</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Symbol
              </label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter symbol"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSymbol}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Token Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium mb-4">Add New Token</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token Address
                </label>
                <input
                  type="text"
                  value={newTokenAddress}
                  onChange={(e) => setNewTokenAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter token address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Contribution (in whole tokens)
                </label>
                <input
                  type="number"
                  value={minContribution}
                  onChange={(e) => setMinContribution(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter minimum contribution amount"
                  min="0"
                  step="0.000000000000000001"
                />
              </div>
              {addTokenError && (
                <p className="mt-2 text-sm text-red-600">{addTokenError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsAddModalOpen(false)
                  setNewTokenAddress('')
                  setMinContribution('')
                  setAddTokenError(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToken}
                disabled={isAdding || !newTokenAddress || !minContribution}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Adding...' : 'Add Token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
