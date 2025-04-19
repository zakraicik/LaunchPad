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
        <button className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2'>
          <PlusIcon className='h-5 w-5' />
          Add Admin
        </button>
      </div>

      <div className='bg-white rounded-lg shadow'>
        <table className='min-w-full'>
          <thead>
            <tr className='border-b'>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Address
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Status
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Last Operation
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Last Updated
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.address} className='border-b'>
                <td className='px-6 py-4 font-mono text-sm'>
                  {admin.address.slice(0, 6)}...{admin.address.slice(-4)}
                </td>
                <td className='px-6 py-4'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      admin.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <span className="text-sm">
                    {admin.lastOperation}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <span className="text-sm text-gray-600" title={admin.lastUpdated}>
                    {formatDate(admin.lastUpdated)}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <div className='flex gap-2'>
                    <button 
                      className='text-red-600 hover:text-red-800'
                      title={admin.isActive ? 'Remove Admin' : 'Restore Admin'}
                    >
                      <TrashIcon className='h-5 w-5' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {admins.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No administrators found.
          </div>
        )}
      </div>
    </div>
  )
}
