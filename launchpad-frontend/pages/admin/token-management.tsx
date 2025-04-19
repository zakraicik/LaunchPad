import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import {
  useTokenRegistry,
  useAddToken,
  useRemoveToken,
  useToggleTokenSupport,
  useUpdateMinContribution
} from '@/hooks/tokenRegistry'
import { useState, useEffect, useRef } from 'react'
import { collection, doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { useAccount, useWriteContract, useChainId } from 'wagmi'
import { useIsAdmin } from '../../utils/admin'
import toast from 'react-hot-toast'
import { formatUnits, parseUnits } from 'ethers'

interface TokenInfo {
  address: string
  symbol: string
  decimals: number
  isSupported: boolean
  minimumContribution: string
  lastOperation: 'TOKEN_ADDED' | 'TOKEN_REMOVED' | string
  lastUpdated: string
}

export default function TokenManagement() {
  const { tokens } = useTokenRegistry()
  const { address } = useAccount()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address)
  const { addToken, isAdding, error } = useAddToken()
  const { removeToken, isRemoving } = useRemoveToken()
  const { toggleSupport, isToggling } = useToggleTokenSupport()
  const { updateMinContribution, isUpdating } = useUpdateMinContribution()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [customSymbol, setCustomSymbol] = useState('')
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({})
  const [newTokenAddress, setNewTokenAddress] = useState('')
  const [minContribution, setMinContribution] = useState('')
  const [addTokenError, setAddTokenError] = useState<string | null>(null)
  const [tokenToRemove, setTokenToRemove] = useState<TokenInfo | null>(null)
  const hasFetchedSymbols = useRef(false)
  const chainId = useChainId()
  const [togglingTokenAddress, setTogglingTokenAddress] = useState<string | null>(null)
  const [isMinAmountModalOpen, setIsMinAmountModalOpen] = useState(false)
  const [selectedTokenForMinAmount, setSelectedTokenForMinAmount] = useState<TokenInfo | null>(null)
  const [newMinAmount, setNewMinAmount] = useState('')

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

  const handleRemoveClick = (token: TokenInfo) => {
    if (!isAdmin) return
    setTokenToRemove(token)
    setIsRemoveModalOpen(true)
  }

  const handleRemoveToken = async () => {
    if (!tokenToRemove || !isAdmin) return

    const toastId = toast.loading('Removing token...')
    try {
      const { txHash } = await removeToken(tokenToRemove.address)
      toast.success('Token removed successfully!', { id: toastId })
      setIsRemoveModalOpen(false)
      setTokenToRemove(null)
    } catch (error) {
      console.error('Error removing token:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove token'
      toast.error(errorMessage, { id: toastId })
    }
  }

  const handleToggleSupport = async (token: TokenInfo) => {
    if (!isAdmin) return
    
    setTogglingTokenAddress(token.address)
    const toastId = toast.loading(`${token.isSupported ? 'Disabling' : 'Enabling'} token support...`)
    
    try {
      await toggleSupport(token.address, !token.isSupported)
      toast.success(`Token support ${token.isSupported ? 'disabled' : 'enabled'} successfully!`, { id: toastId })
    } catch (error) {
      console.error('Error toggling token support:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle token support'
      toast.error(errorMessage, { id: toastId })
    } finally {
      setTogglingTokenAddress(null)
    }
  }

  const handleEditMinAmount = (token: TokenInfo) => {
    if (!isAdmin) return
    setSelectedTokenForMinAmount(token)
    // Convert WEI to whole tokens using the token's decimals
    const wholeTokens = formatUnits(token.minimumContribution, token.decimals)
    setNewMinAmount(wholeTokens)
    setIsMinAmountModalOpen(true)
  }

  const handleUpdateMinAmount = async () => {
    if (!selectedTokenForMinAmount || !isAdmin || !newMinAmount) return

    const toastId = toast.loading('Updating minimum contribution...')
    try {
      // Convert whole tokens back to WEI using the token's decimals
      const amountInWei = parseUnits(newMinAmount, selectedTokenForMinAmount.decimals).toString()
      await updateMinContribution(selectedTokenForMinAmount.address, amountInWei)
      toast.success('Minimum contribution updated successfully!', { id: toastId })
      setIsMinAmountModalOpen(false)
      setSelectedTokenForMinAmount(null)
      setNewMinAmount('')
    } catch (error) {
      console.error('Error updating minimum contribution:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update minimum contribution'
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
              <th className='px-6 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wider'>Address</th>
              <th className='px-6 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wider'>Symbol</th>
              <th className='px-6 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wider'>Status</th>
              <th className='px-6 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wider'>Min Amount</th>
              <th className='px-6 py-3 text-left text-sm font-semibold text-gray-500 uppercase tracking-wider'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200'>
            {tokens?.map(token => (
              <tr key={token.address} className='border-b hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap font-mono text-sm'>
                  {token.address.slice(0,6)}...{token.address.slice(-4)}
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{tokenSymbols[token.address.toLowerCase()] || token.symbol || 'No symbol set'}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditClick(token)}
                        className='text-blue-600 hover:text-blue-800'
                      >
                        <PencilIcon className='h-5 w-5' />
                      </button>
                    )}
                  </div>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      token.isSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {token.isSupported ? 'Supported' : 'Not Supported'}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleToggleSupport(token)}
                        disabled={isToggling && togglingTokenAddress === token.address}
                        className={`p-1 rounded-full transition-colors ${
                          token.isSupported
                            ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        } disabled:opacity-50`}
                        title={token.isSupported ? 'Disable Support' : 'Enable Support'}
                      >
                        {token.isSupported ? (
                          <XCircleIcon className='h-5 w-5' />
                        ) : (
                          <CheckCircleIcon className='h-5 w-5' />
                        )}
                      </button>
                    )}
                  </div>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{formatUnits(token.minimumContribution, token.decimals)}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditMinAmount(token)}
                        className='text-blue-600 hover:text-blue-800'
                      >
                        <PencilIcon className='h-5 w-5' />
                      </button>
                    )}
                  </div>
                </td>
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className='flex gap-2'>
                    <button 
                      onClick={() => handleRemoveClick(token)}
                      className='text-red-600 hover:text-red-800 disabled:opacity-50'
                      disabled={!isAdmin}
                    >
                      <TrashIcon className='h-5 w-5' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tokens?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No tokens found.
          </div>
        )}
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

      {/* Remove Token Modal */}
      {isRemoveModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium mb-4">Remove Token</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove {tokenToRemove?.symbol}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsRemoveModalOpen(false)
                  setTokenToRemove(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveToken}
                disabled={isRemoving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Min Amount Modal */}
      {isMinAmountModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium mb-4">Edit Minimum Contribution</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Contribution (in {selectedTokenForMinAmount?.symbol || 'tokens'})
              </label>
              <input
                type="number"
                value={newMinAmount}
                onChange={(e) => setNewMinAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter minimum contribution amount"
                min="0"
                step="0.000000000000000001"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsMinAmountModalOpen(false)
                  setSelectedTokenForMinAmount(null)
                  setNewMinAmount('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMinAmount}
                disabled={isUpdating || !newMinAmount}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
