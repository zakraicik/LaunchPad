import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '../../components/auth/ProtectedRoute'

interface Campaign {
  id: string
  name: string
  description: string
  createdAt: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  totalRaised: number
  contributors: number
}

export default function ManageCampaigns () {
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)

  // Example campaigns data - replace with actual data fetching
  const campaigns: Campaign[] = [
    {
      id: '1',
      name: 'Ocean Cleanup Initiative',
      description: 'Help us clean the oceans and protect marine life',
      createdAt: '2024-03-15',
      status: 'active',
      totalRaised: 5000,
      contributors: 12
    },
    {
      id: '2',
      name: 'Renewable Energy Project',
      description: 'Supporting clean energy transition',
      createdAt: '2024-03-10',
      status: 'draft',
      totalRaised: 0,
      contributors: 0
    }
  ]

  const getStatusBadgeColor = (status: Campaign['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
    }
  }

  const handleCreateCampaign = () => {
    // TODO: Implement campaign creation
  }

  const handleEditCampaign = (id: string) => {
    // TODO: Implement campaign editing
  }

  const handleDeleteCampaign = (id: string) => {
    // TODO: Implement campaign deletion
  }

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold'>Manage Campaigns</h1>
            <p className='text-gray-600 mt-2'>
              Create and manage your fundraising campaigns
            </p>
          </div>

          <div className='bg-white rounded-lg shadow'>
            <div className='p-6'>
              <div className='flex justify-between items-center mb-6'>
                <div>
                  <h2 className='text-xl font-semibold'>Your Campaigns</h2>
                  <p className='text-sm text-gray-500 mt-1'>
                    {campaigns.length} campaign
                    {campaigns.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={handleCreateCampaign}
                  className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  <PlusIcon className='w-5 h-5 mr-2' />
                  Create Campaign
                </button>
              </div>

              <div className='mt-6'>
                <div className='overflow-x-auto'>
                  <table className='min-w-full divide-y divide-gray-200'>
                    <thead className='bg-gray-50'>
                      <tr>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Campaign
                        </th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Status
                        </th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Total Raised
                        </th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Contributors
                        </th>
                        <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {campaigns.map(campaign => (
                        <tr key={campaign.id}>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            <div className='flex items-center'>
                              <div>
                                <div className='font-medium'>
                                  {campaign.name}
                                </div>
                                <div className='text-gray-500'>
                                  Created{' '}
                                  {new Date(
                                    campaign.createdAt
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                                campaign.status
                              )}`}
                            >
                              {campaign.status.charAt(0).toUpperCase() +
                                campaign.status.slice(1)}
                            </span>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                            ${campaign.totalRaised.toLocaleString()}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                            {campaign.contributors}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                            <button
                              className='text-blue-600 hover:text-blue-900 mr-4'
                              onClick={() => handleEditCampaign(campaign.id)}
                            >
                              Edit
                            </button>
                            <button
                              className='text-red-600 hover:text-red-900'
                              onClick={() => handleDeleteCampaign(campaign.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
