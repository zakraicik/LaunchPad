import { useRouter } from 'next/router'
import { useState } from 'react'
import { ShareIcon } from '@heroicons/react/24/outline'
import Contributors from '../../components/campaigns/Contributors'

// We'll move this to a proper data fetching solution later
import { dummyCampaigns } from './index'

// Sample contributors data
const sampleContributors = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    amount: 25000,
    timestamp: '2 days ago',
    isTopContributor: true
  },
  {
    address: '0x2345678901abcdef2345678901abcdef23456789',
    amount: 15000,
    timestamp: '3 days ago',
    isTopContributor: true
  },
  {
    address: '0x3456789012abcdef3456789012abcdef34567890',
    amount: 10000,
    timestamp: '4 days ago',
    isTopContributor: true
  },
  {
    address: '0x4567890123abcdef4567890123abcdef45678901',
    amount: 5000,
    timestamp: '5 days ago',
    isTopContributor: false
  },
  {
    address: '0x5678901234abcdef5678901234abcdef56789012',
    amount: 2500,
    timestamp: '6 days ago',
    isTopContributor: false
  }
]

export default function CampaignDetail () {
  const router = useRouter()
  const { id } = router.query
  const [activeTab, setActiveTab] = useState('details')

  // Find campaign from dummy data (will be replaced with API call)
  const campaign = dummyCampaigns.find(c => c.id === Number(id))

  if (!campaign) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='container mx-auto px-4'>
          <div className='text-center'>Campaign not found</div>
        </div>
      </div>
    )
  }

  const progress = (campaign.raised / campaign.target) * 100

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='container mx-auto px-4'>
        {/* Campaign Header */}
        <div className='bg-white rounded-lg shadow-sm overflow-hidden mb-6'>
          <div className='aspect-w-16 aspect-h-9 bg-gray-200'>
            {/* Replace with actual Image component */}
            <div className='w-full h-96 bg-gray-200'></div>
          </div>

          <div className='p-6'>
            <div className='flex justify-between items-start mb-4'>
              <div>
                <span className='inline-block px-2 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-2'>
                  {campaign.category}
                </span>
                <h1 className='text-3xl font-bold'>{campaign.title}</h1>
              </div>
              <button
                className='p-2 hover:bg-gray-100 rounded-full'
                aria-label='Share'
              >
                <ShareIcon className='h-6 w-6 text-gray-600' />
              </button>
            </div>

            {/* Progress Section */}
            <div className='mb-6'>
              <div className='w-full bg-gray-200 rounded-full h-3'>
                <div
                  className='bg-blue-600 h-3 rounded-full'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className='flex justify-between items-center mt-4'>
                <div>
                  <p className='text-2xl font-bold'>
                    ${campaign.raised.toLocaleString()}
                  </p>
                  <p className='text-sm text-gray-600'>
                    raised of ${campaign.target.toLocaleString()}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-2xl font-bold'>{campaign.daysLeft}</p>
                  <p className='text-sm text-gray-600'>days left</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-3 gap-4 py-4 border-t border-b'>
              <div>
                <p className='text-2xl font-bold'>{campaign.backers}</p>
                <p className='text-sm text-gray-600'>contributors</p>
              </div>
              <div>
                <p className='text-2xl font-bold'>{campaign.avgYield}%</p>
                <p className='text-sm text-gray-600'>APY</p>
              </div>
              <div>
                <p className='text-2xl font-bold'>USDC</p>
                <p className='text-sm text-gray-600'>target coin</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='bg-white rounded-lg shadow-sm mb-6'>
          <div className='border-b'>
            <nav className='flex'>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('updates')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'updates'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Updates
              </button>
              <button
                onClick={() => setActiveTab('contributors')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'contributors'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Contributors
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'faq'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                FAQ
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className='p-6'>
            {activeTab === 'details' && (
              <div className='prose max-w-none'>
                <p>{campaign.description}</p>
                {/* We'll add more detailed content here */}
              </div>
            )}

            {activeTab === 'updates' && (
              <div>
                <p className='text-gray-600'>No updates yet</p>
              </div>
            )}

            {activeTab === 'contributors' && (
              <Contributors
                contributors={sampleContributors}
                totalContributors={campaign.backers}
              />
            )}

            {activeTab === 'faq' && (
              <div>
                <p className='text-gray-600'>Loading FAQ...</p>
              </div>
            )}
          </div>
        </div>

        {/* Contribution Form */}
        <div className='bg-white rounded-lg shadow-sm p-6'>
          <h2 className='text-xl font-bold mb-4'>Make a Contribution</h2>
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Amount (USDC)
              </label>
              <input
                type='number'
                min='0'
                placeholder='Enter amount'
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
            <button className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors'>
              Contribute
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
