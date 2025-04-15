import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function TokenManagement () {
  const [tokens] = useState([
    {
      id: 1,
      name: 'USDT',
      symbol: 'USDT',
      status: 'Active',
      minAmount: '100',
      maxAmount: '100000'
    },
    {
      id: 2,
      name: 'USDC',
      symbol: 'USDC',
      status: 'Active',
      minAmount: '100',
      maxAmount: '100000'
    },
    {
      id: 3,
      name: 'ETH',
      symbol: 'ETH',
      status: 'Inactive',
      minAmount: '0.1',
      maxAmount: '10'
    }
  ])

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Token Management</h1>
        <button className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2'>
          <PlusIcon className='h-5 w-5' />
          Add Token
        </button>
      </div>

      <div className='bg-white rounded-lg shadow'>
        <table className='min-w-full'>
          <thead>
            <tr className='border-b'>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Token Name
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Symbol
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Status
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Min Amount
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Max Amount
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(token => (
              <tr key={token.id} className='border-b'>
                <td className='px-6 py-4'>{token.name}</td>
                <td className='px-6 py-4'>{token.symbol}</td>
                <td className='px-6 py-4'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      token.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {token.status}
                  </span>
                </td>
                <td className='px-6 py-4'>{token.minAmount}</td>
                <td className='px-6 py-4'>{token.maxAmount}</td>
                <td className='px-6 py-4'>
                  <div className='flex gap-2'>
                    <button className='text-blue-600 hover:text-blue-800'>
                      <PencilIcon className='h-5 w-5' />
                    </button>
                    <button className='text-red-600 hover:text-red-800'>
                      <TrashIcon className='h-5 w-5' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
