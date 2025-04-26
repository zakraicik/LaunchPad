import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
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
import { useRouter } from 'next/router'

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
  const router = useRouter()
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
  const [showAddressPopover, setShowAddressPopover] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hasFetchedSymbols = useRef(false)
  const chainId = useChainId()
  const [togglingTokenAddress, setTogglingTokenAddress] = useState<string | null>(null)
  const [isMinAmountModalOpen, setIsMinAmountModalOpen] = useState(false)
  const [selectedTokenForMinAmount, setSelectedTokenForMinAmount] = useState<TokenInfo | null>(null)
  const [newMinAmount, setNewMinAmount] = useState('')
  const { writeContract, isPending, isError: writeContractError } = useWriteContract()

  // Redirect if not admin
  useEffect(() => {
    if (!isLoadingAdmin && !isAdmin) {
      router.push('/')
      toast.error('You do not have permission to access this page')
    }
  }, [isAdmin, isLoadingAdmin, router])

  // Click outside handler for popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowAddressPopover(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch custom symbols
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

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

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
      
      // Create/update token record in Firebase with networkId
      const tokenRef = doc(collection(db, 'tokens'), newTokenAddress.toLowerCase())
      await setDoc(tokenRef, {
        networkId: chainId.toString(),
        lastOperation: 'TOKEN_ADDED',
        lastUpdated: new Date().toISOString(),
        isSupported: true,
        minimumContribution: minContribution
      }, { merge: true })

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

  // Show loading state while checking admin status
  if (isLoadingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show nothing if not admin (redirect will happen)
  if (!isAdmin) {
    return null
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20'>
      <div className='container mx-auto px-4'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-2xl font-bold'>Token Management</h1>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className='bg-blue-600 text-white p-2 md:px-4 md:py-2 rounded-lg flex items-center gap-2'
            title="Add Token"
          >
            <PlusIcon className='h-5 w-5' />
            <span className='hidden md:inline'>Add Token</span>
          </button>
        </div>

        {/* Card Grid Layout */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {tokens?.map(token => (
            <div key={token.address} className='bg-white rounded-lg shadow p-4 space-y-4'>
              {/* Header with symbol and remove button */}
              <div className='flex justify-between items-start'>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <span className="text-sm font-medium">{tokenSymbols[token.address.toLowerCase()] || token.symbol || 'No symbol set'}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => handleEditClick(token)}
                        className='text-blue-600 hover:text-blue-800'
                        title="Edit Symbol"
                      >
                        <PencilIcon className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                  <div className='relative'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation() // Prevent event from bubbling
                        setShowAddressPopover(showAddressPopover === token.address ? null : token.address)
                      }}
                      className='font-mono text-xs text-gray-500 hover:text-gray-700'
                    >
                      {token.address.slice(0,6)}...{token.address.slice(-4)}
                    </button>
                    
                    {/* Address Popover */}
                    {showAddressPopover === token.address && (
                      <div 
                        ref={popoverRef}
                        className='absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-fit min-w-[300px]'
                      >
                        <div className='flex items-start gap-2'>
                          <div className='font-mono text-sm break-all'>{token.address}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation() // Prevent event from bubbling
                              handleCopyAddress(token.address)
                            }}
                            className='flex-shrink-0 text-gray-500 hover:text-gray-700'
                            title="Copy Address"
                          >
                            {copiedAddress === token.address ? (
                              <ClipboardDocumentCheckIcon className='h-5 w-5 text-green-600' />
                            ) : (
                              <ClipboardIcon className='h-5 w-5' />
                            )}
                          </button>
                        </div>
                        <div className='mt-2 text-xs text-gray-500'>
                          <a
                            href={`https://etherscan.io/token/${token.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className='text-blue-600 hover:text-blue-800'
                            onClick={(e) => e.stopPropagation()} // Prevent event from bubbling
                          >
                            View on Etherscan
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => handleRemoveClick(token)}
                    className='text-red-600 hover:text-red-800 disabled:opacity-50'
                    disabled={!isAdmin}
                    title="Remove Token"
                  >
                    <TrashIcon className='h-5 w-5' />
                  </button>
                )}
              </div>

              {/* Token settings section */}
              <div className='space-y-4 pt-2 border-t border-gray-100'>
                {/* Support Status */}
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-gray-500'>Support Status</span>
                  <button
                    onClick={() => isAdmin && handleToggleSupport(token)}
                    disabled={isToggling && togglingTokenAddress === token.address || !isAdmin}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      token.isSupported ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={token.isSupported}
                    title={isAdmin ? (token.isSupported ? 'Disable Support' : 'Enable Support') : 'Only admins can change token support'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        token.isSupported ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Minimum Contribution */}
                <div className='flex justify-between items-center'>
                  <div>
                    <span className='text-sm text-gray-500'>Minimum Contribution</span>
                    <div className='text-sm text-gray-900 font-medium'>
                      {formatUnits(token.minimumContribution, token.decimals)}
                    </div>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => handleEditMinAmount(token)}
                      className='text-blue-600 hover:text-blue-800'
                      title="Edit Minimum Contribution"
                    >
                      <PencilIcon className='h-5 w-5' />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {tokens?.length === 0 && (
            <div className="col-span-full text-center py-12">
              <h3 className='text-xl font-semibold mb-4'>
                No tokens found
              </h3>
              <p className='text-gray-600 mb-6'>
                Add your first token to get started!
              </p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto'
              >
                <PlusIcon className='h-5 w-5' />
                Add Token
              </button>
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
    </div>
  )
}
