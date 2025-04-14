import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  PlusIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  FolderIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '../../components/auth/ProtectedRoute'
import CreateCampaignModal from '../../components/campaigns/CreateCampaignModal'
import { useCampaigns } from '../../hooks/useCampaigns'

interface DashboardStats {
  totalFundsRaised: number
  totalYieldGenerated: number
  totalContributors: number
  activeCampaigns: number
  averageAPY: number
}

export default function ManageCampaigns () {
  const [mounted, setMounted] = useState(false)
  const { address } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'campaigns' | 'yield' | 'settings'
  >('overview')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { campaigns, isLoading: isLoadingCampaigns } = useCampaigns()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dashboard stats from real campaign data
  const dashboardStats: DashboardStats = {
    totalFundsRaised: campaigns.reduce(
      (sum, campaign) => sum + Number(campaign.totalRaised),
      0
    ),
    totalYieldGenerated: campaigns.reduce(
      (sum, campaign) => sum + Number(campaign.yieldGenerated),
      0
    ),
    totalContributors: campaigns.reduce(
      (sum, campaign) => sum + campaign.contributors,
      0
    ),
    activeCampaigns: campaigns.filter(campaign => campaign.status === 'active')
      .length,
    averageAPY:
      campaigns.length > 0
        ? campaigns.reduce((sum, campaign) => sum + campaign.currentAPY, 0) /
          campaigns.length
        : 0
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreateCampaign = async (data: any) => {
    // TODO: Implement campaign creation logic
    console.log('Creating campaign with data:', data)
  }

  const handleEditCampaign = (id: string) => {
    // TODO: Implement campaign editing
  }

  const handleDeleteCampaign = (id: string) => {
    // TODO: Implement campaign deletion
  }

  const renderOverview = () => (
    <div className='space-y-6'>
      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Total Funds Raised</p>
              <p className='text-2xl font-bold text-blue-600'>
                ${dashboardStats.totalFundsRaised.toLocaleString()}
              </p>
            </div>
            <CurrencyDollarIcon className='w-8 h-8 text-blue-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Total Yield Generated</p>
              <p className='text-2xl font-bold text-green-600'>
                ${dashboardStats.totalYieldGenerated.toLocaleString()}
              </p>
            </div>
            <ArrowTrendingUpIcon className='w-8 h-8 text-green-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Total Contributors</p>
              <p className='text-2xl font-bold text-purple-600'>
                {dashboardStats.totalContributors}
              </p>
            </div>
            <UserGroupIcon className='w-8 h-8 text-purple-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Active Campaigns</p>
              <p className='text-2xl font-bold text-indigo-600'>
                {dashboardStats.activeCampaigns}
              </p>
            </div>
            <FolderIcon className='w-8 h-8 text-indigo-500' />
          </div>
        </div>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-500'>Average APY</p>
              <p className='text-2xl font-bold text-yellow-600'>
                {dashboardStats.averageAPY.toFixed(2)}%
              </p>
            </div>
            <ChartBarIcon className='w-8 h-8 text-yellow-500' />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className='bg-white rounded-lg shadow'>
        <div className='p-6'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>
            Recent Activity
          </h3>
          <div className='space-y-4'>
            {campaigns.slice(0, 2).map(campaign => (
              <div key={campaign.id} className='flex items-center space-x-4'>
                <div className='flex-shrink-0'>
                  <div className='w-8 h-8 rounded-full bg-green-100 flex items-center justify-center'>
                    <CurrencyDollarIcon className='w-4 h-4 text-green-600' />
                  </div>
                </div>
                <div className='flex-1'>
                  <p className='text-sm text-gray-900'>{campaign.title}</p>
                  <p className='text-sm text-gray-500'>
                    ${Number(campaign.totalRaised).toLocaleString()} raised
                  </p>
                </div>
                <div className='text-sm text-gray-500'>
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderCampaigns = () => (
    <div>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h2 className='text-xl font-semibold'>Your Campaigns</h2>
          <p className='text-sm text-gray-500 mt-1'>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        >
          <PlusIcon className='w-5 h-5 mr-2' />
          Create Campaign
        </button>
      </div>

      <div className='bg-white rounded-lg shadow overflow-hidden'>
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
                Yield Generated
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
                      <div className='font-medium'>{campaign.title}</div>
                      <div className='text-gray-500'>
                        Created{' '}
                        {new Date(campaign.createdAt).toLocaleDateString()}
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
                  ${Number(campaign.totalRaised).toLocaleString()}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {campaign.contributors}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  ${Number(campaign.yieldGenerated).toLocaleString()}
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
  )

  const renderYield = () => (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold mb-4'>Yield Management</h2>

        {/* Campaign-specific yield management */}
        <div className='space-y-6'>
          {campaigns.map(campaign => (
            <div key={campaign.id} className='border rounded-lg p-4'>
              <div className='flex justify-between items-start mb-4'>
                <div>
                  <h3 className='text-lg font-medium text-gray-900'>
                    {campaign.title}
                  </h3>
                  <p className='text-sm text-gray-500'>
                    {campaign.description}
                  </p>
                </div>
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                    campaign.status
                  )}`}
                >
                  {campaign.status.charAt(0).toUpperCase() +
                    campaign.status.slice(1)}
                </span>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div>
                  <h4 className='text-sm font-medium text-gray-900 mb-3'>
                    Campaign Yield Stats
                  </h4>
                  <div className='space-y-3'>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>
                        Total Raised
                      </span>
                      <span className='text-sm font-medium'>
                        ${Number(campaign.totalRaised).toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>
                        Deposited Amount
                      </span>
                      <span className='text-sm font-medium'>
                        ${Number(campaign.depositedAmount).toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>
                        Available Yield
                      </span>
                      <span className='text-sm font-medium'>
                        ${Number(campaign.availableYield).toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>Current APY</span>
                      <span className='text-sm font-medium'>
                        {campaign.currentAPY}%
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className='text-sm font-medium text-gray-900 mb-3'>
                    Yield Actions
                  </h4>
                  <div className='space-y-3'>
                    <button
                      className='w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      onClick={() => handleHarvestYield(campaign.id)}
                      disabled={
                        campaign.status !== 'active' ||
                        Number(campaign.availableYield) === 0
                      }
                    >
                      Harvest Yield
                    </button>
                    <button
                      className='w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                      onClick={() => handleDepositToYield(campaign.id)}
                      disabled={
                        campaign.status !== 'active' ||
                        Number(campaign.totalRaised) ===
                          Number(campaign.depositedAmount)
                      }
                    >
                      Deposit to Yield Protocol
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall yield statistics */}
        <div className='mt-8 pt-6 border-t'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>
            Overall Yield Statistics
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='bg-gray-50 rounded-lg p-4'>
              <p className='text-sm text-gray-500'>Total Yield Generated</p>
              <p className='text-2xl font-bold text-green-600'>
                ${dashboardStats.totalYieldGenerated.toLocaleString()}
              </p>
            </div>
            <div className='bg-gray-50 rounded-lg p-4'>
              <p className='text-sm text-gray-500'>Total Deposited</p>
              <p className='text-2xl font-bold text-blue-600'>
                $
                {campaigns
                  .reduce(
                    (sum, campaign) => sum + Number(campaign.depositedAmount),
                    0
                  )
                  .toLocaleString()}
              </p>
            </div>
            <div className='bg-gray-50 rounded-lg p-4'>
              <p className='text-sm text-gray-500'>Average APY</p>
              <p className='text-2xl font-bold text-yellow-600'>
                {dashboardStats.averageAPY.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const handleHarvestYield = async (campaignId: string) => {
    // TODO: Implement harvest yield for specific campaign
    console.log('Harvesting yield for campaign:', campaignId)
  }

  const handleDepositToYield = async (campaignId: string) => {
    // TODO: Implement deposit to yield protocol for specific campaign
    console.log('Depositing to yield protocol for campaign:', campaignId)
  }

  const renderSettings = () => (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold mb-4'>Creator Settings</h2>
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>
              Profile Settings
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>
                  Display Name
                </label>
                <input
                  type='text'
                  className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                  placeholder='Your display name'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>
                  Bio
                </label>
                <textarea
                  rows={3}
                  className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                  placeholder='Tell us about yourself'
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>
              Notification Preferences
            </h3>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium text-gray-900'>
                    New Contributions
                  </h4>
                  <p className='text-sm text-gray-500'>
                    Get notified when you receive new contributions
                  </p>
                </div>
                <button className='relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-blue-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'>
                  <span className='translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out' />
                </button>
              </div>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium text-gray-900'>
                    Yield Updates
                  </h4>
                  <p className='text-sm text-gray-500'>
                    Get notified about yield generation
                  </p>
                </div>
                <button className='relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-blue-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'>
                  <span className='translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out' />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold'>Creator Dashboard</h1>
            <p className='text-gray-600 mt-2'>
              Manage your campaigns and track performance
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className='bg-white rounded-lg shadow mb-6'>
            <div className='border-b border-gray-200'>
              <nav className='flex space-x-8 px-6' aria-label='Tabs'>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <ChartBarIcon className='w-5 h-5 mr-2' />
                    Overview
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'campaigns'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <FolderIcon className='w-5 h-5 mr-2' />
                    Campaigns
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('yield')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'yield'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <ArrowTrendingUpIcon className='w-5 h-5 mr-2' />
                    Yield Management
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <Cog6ToothIcon className='w-5 h-5 mr-2' />
                    Settings
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className='bg-white rounded-lg shadow'>
            <div className='p-6'>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'campaigns' && renderCampaigns()}
              {activeTab === 'yield' && renderYield()}
              {activeTab === 'settings' && renderSettings()}
            </div>
          </div>
        </div>

        {/* Create Campaign Modal */}
        {mounted && (
          <CreateCampaignModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}
