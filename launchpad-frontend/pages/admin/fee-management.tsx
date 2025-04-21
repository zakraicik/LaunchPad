import { useState, useRef, useEffect } from 'react'
import { useFeeManager } from '@/hooks/feeManagement/useFeeManager'
import { formatDistanceToNow, isValid } from 'date-fns'
import { PencilIcon, ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import { useIsAdmin } from '@/utils/admin'
import { useAccount } from 'wagmi'
import { Timestamp } from 'firebase/firestore'

export default function FeeManagement() {
  const { feeSettings, isLoading, error } = useFeeManager()
  const { address } = useAccount()
  const { isAdmin } = useIsAdmin(address)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showAddressPopover, setShowAddressPopover] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Click outside handler for popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowAddressPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const formatDate = (timestamp: Timestamp | string) => {
    try {
      // Handle Firebase Timestamp
      const date = typeof timestamp === 'object' && 'toDate' in timestamp
        ? (timestamp as Timestamp).toDate()
        : new Date(timestamp)

      if (!isValid(date)) return 'Invalid date'
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (err) {
      console.error('Error formatting date:', err)
      return 'Invalid date'
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="text-gray-600">Loading fee settings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading fee settings: {error}
        </div>
      </div>
    )
  }

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Fee Management</h1>
      </div>

      <div className='bg-white rounded-lg shadow'>
        <div className='p-6 space-y-6'>
          {/* Platform Fee Share */}
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Platform Fee Share</h3>
              <p className='mt-1 text-2xl font-semibold'>{feeSettings?.platformFeeShare}
                <span className='text-sm text-gray-500 ml-1'>basis points</span>
              </p>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className='text-blue-600 hover:text-blue-800'
              >
                <PencilIcon className='h-5 w-5' />
              </button>
            )}
          </div>

          {/* Treasury Address */}
          <div>
            <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Treasury Address</h3>
            <div className='mt-1 flex items-center justify-between'>
              <div className='relative'>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddressPopover(!showAddressPopover)
                  }}
                  className='font-mono text-sm text-gray-600 hover:text-gray-800'
                >
                  {feeSettings?.treasuryAddress ? 
                    `${feeSettings.treasuryAddress.slice(0,6)}...${feeSettings.treasuryAddress.slice(-4)}` :
                    'No address set'
                  }
                </button>

                {/* Address Popover */}
                {showAddressPopover && feeSettings?.treasuryAddress && (
                  <div 
                    ref={popoverRef}
                    className='absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-fit min-w-[300px]'
                  >
                    <div className='flex items-start gap-2'>
                      <div className='font-mono text-sm break-all'>{feeSettings.treasuryAddress}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopyAddress(feeSettings.treasuryAddress)
                        }}
                        className='flex-shrink-0 text-gray-500 hover:text-gray-700'
                        title="Copy Address"
                      >
                        {copiedAddress ? (
                          <ClipboardDocumentCheckIcon className='h-5 w-5 text-green-600' />
                        ) : (
                          <ClipboardIcon className='h-5 w-5' />
                        )}
                      </button>
                    </div>
                    <div className='mt-2 text-xs text-gray-500'>
                      <a
                        href={`https://etherscan.io/address/${feeSettings.treasuryAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className='text-blue-600 hover:text-blue-800'
                        onClick={(e) => e.stopPropagation()}
                      >
                        View on Etherscan
                      </a>
                    </div>
                  </div>
                )}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className='text-blue-600 hover:text-blue-800'
                >
                  <PencilIcon className='h-5 w-5' />
                </button>
              )}
            </div>
          </div>

          {/* Last Updated */}
          <div>
            <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wider'>Last Updated</h3>
            <p className='mt-1 text-sm text-gray-600'>
              {feeSettings?.lastUpdated && formatDate(feeSettings.lastUpdated)}
            </p>
            <p className='mt-1 text-sm text-gray-600'>
              Operation: {feeSettings?.lastOperation}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal placeholder - implement actual modal based on your needs */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-medium mb-4">Edit Fee Settings</h2>
            {/* Add your form fields here */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
