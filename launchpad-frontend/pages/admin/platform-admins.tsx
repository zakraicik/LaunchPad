import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { usePlatformAdmin } from '@/hooks/platformAdmin/usePlatformAdmin'
import { formatDistanceToNow, isValid } from 'date-fns'
import { Timestamp } from 'firebase/firestore'

export default function PlatformAdmins() {
  const { admins, isLoading, error } = usePlatformAdmin()

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
        <button className='bg-blue-600 text-white p-2 md:px-4 md:py-2 rounded-lg flex items-center gap-2'>
          <PlusIcon className='h-5 w-5' />
          <span className='hidden md:inline'>Add Admin</span>
        </button>
      </div>

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
                className='text-red-600 hover:text-red-800'
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
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            No administrators found.
          </div>
        )}
      </div>
    </div>
  )
}
