import { useState } from 'react'
import { PencilIcon, CheckIcon } from '@heroicons/react/24/outline'

export default function FeeManagement () {
  const [feeStructures] = useState([
    {
      id: 1,
      type: 'Platform Fee',
      percentage: 2.5,
      description: 'Standard platform fee for all transactions',
      lastUpdated: '2024-03-15'
    },
    {
      id: 2,
      type: 'Early Withdrawal Fee',
      percentage: 5.0,
      description: 'Fee for withdrawing before campaign completion',
      lastUpdated: '2024-03-14'
    },
    {
      id: 3,
      type: 'Creator Success Fee',
      percentage: 1.5,
      description: 'Fee charged on successful campaign completion',
      lastUpdated: '2024-03-10'
    }
  ])

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Fee Management</h1>
      </div>

      <div className='grid gap-6'>
        {feeStructures.map(fee => (
          <div key={fee.id} className='bg-white rounded-lg shadow p-6'>
            <div className='flex justify-between items-start mb-4'>
              <div>
                <h3 className='text-lg font-semibold'>{fee.type}</h3>
                <p className='text-gray-600 text-sm mt-1'>{fee.description}</p>
              </div>
              <button className='text-blue-600 hover:text-blue-800'>
                <PencilIcon className='h-5 w-5' />
              </button>
            </div>

            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Fee Percentage
                </label>
                <div className='flex items-center'>
                  <input
                    type='number'
                    value={fee.percentage}
                    className='block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                    step='0.1'
                    min='0'
                    max='100'
                  />
                  <span className='ml-2'>%</span>
                </div>
              </div>

              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Last Updated
                </label>
                <p className='text-gray-600'>{fee.lastUpdated}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='mt-6 flex justify-end'>
        <button className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2'>
          <CheckIcon className='h-5 w-5' />
          Save Changes
        </button>
      </div>
    </div>
  )
}
