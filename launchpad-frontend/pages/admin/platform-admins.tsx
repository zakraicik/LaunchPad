import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { usePlatformAdmin } from '@/hooks/platformAdmin/usePlatformAdmin'
import { useAddPlatformAdmin } from '@/hooks/platformAdmin/useAddPlatformAdmin'
import { useRemovePlatformAdmin } from '@/hooks/platformAdmin/useRemovePlatformAdmin'
import { formatDistanceToNow, isValid } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'

export default function PlatformAdmins() {
  const { admins, isLoading, error } = usePlatformAdmin()
  const { addPlatformAdmin, isAdding, error: addError } = useAddPlatformAdmin()
  const { removePlatformAdmin, isRemoving, error: removeError } = useRemovePlatformAdmin()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newAdminAddress, setNewAdminAddress] = useState('')

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    const toastId = toast.loading('Adding platform admin...')
    try {
      await addPlatformAdmin(newAdminAddress)
      toast.success('Platform admin added successfully!', { id: toastId })
      setIsModalOpen(false)
      setNewAdminAddress('')
    } catch (err) {
      console.error('Failed to add admin:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add platform admin'
      toast.error(errorMessage, { id: toastId })
    }
  }

  const handleRemoveAdmin = async (adminAddress: string) => {
    const toastId = toast.loading('Removing platform admin...')
    try {
      await removePlatformAdmin(adminAddress)
      toast.success('Platform admin removed successfully!', { id: toastId })
    } catch (err) {
      console.error('Failed to remove admin:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove platform admin'
      toast.error(errorMessage, { id: toastId })
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
        <div className="text-gray-600">Loading administrators...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading administrators: {error}
        </div>
      </div>
    )
  }

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Platform Administrators</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className='bg-blue-600 text-white p-2 md:px-4 md:py-2 rounded-lg flex items-center gap-2'
        >
          <PlusIcon className='h-5 w-5' />
          <span className='hidden md:inline'>Add Admin</span>
        </button>
      </div>

      {/* Add Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Admin</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label htmlFor="adminAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Address
                </label>
                <input
                  type="text"
                  id="adminAddress"
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0x..."
                  required
                />
              </div>

              {addError && (
                <div className="text-red-600 text-sm">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isAdding ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {admins.map(admin => (
          <div key={admin.address} className='bg-white rounded-lg shadow p-4 space-y-4'>
            {/* Header with address and remove button */}
            <div className='flex justify-between items-start'>
              <div className='space-y-1'>
                <div className='font-mono text-sm'>
                  {admin.address.slice(0, 6)}...{admin.address.slice(-4)}
                </div>
                <div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      admin.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => handleRemoveAdmin(admin.address)}
                disabled={isRemoving}
                className='text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed'
                title={admin.isActive ? 'Remove Admin' : 'Restore Admin'}
              >
                <TrashIcon className='h-5 w-5' />
              </button>
            </div>

            {/* Admin details section */}
            <div className='space-y-3 pt-2 border-t border-gray-100'>
              {/* Last Operation */}
              <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-500'>Last Operation</span>
                <span className="text-sm font-medium">
                  {admin.lastOperation}
                </span>
              </div>

              {/* Last Updated */}
              <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-500'>Last Updated</span>
                <span className="text-sm font-medium text-gray-600" title={admin.lastUpdated}>
                  {formatDate(admin.lastUpdated)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="col-span-full text-center py-12">
            <h3 className='text-xl font-semibold mb-4'>
              No administrators found
            </h3>
            <p className='text-gray-600 mb-6'>
              Add your first platform administrator to get started!
            </p>
            <button 
              className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto'
            >
              <PlusIcon className='h-5 w-5' />
              Add Admin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
