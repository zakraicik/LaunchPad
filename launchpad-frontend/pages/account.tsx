import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  BellIcon,
  WalletIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { GetServerSideProps } from 'next'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

interface NotificationPreferences {
  yieldEarned: boolean
  campaignUpdates: boolean
  refundAvailable: boolean
  emailNotifications: boolean
}

interface UserProfile {
  displayName: string
  email: string
  bio: string
}

interface Campaign {
  id: string
  name: string
  description: string
  totalContributed: number
  yieldEarned: number
  hasClaimableYield: boolean
  refundEligible: boolean
  status: 'active' | 'successful' | 'unsuccessful'
  contributions: Contribution[]
}

interface Contribution {
  date: string
  amount: number
  yieldEarned: number
  txHash: string
  apy: number
}

export const getServerSideProps: GetServerSideProps = async context => {
  // Since wallet connection state is client-side,
  // we'll handle the actual protection in the ProtectedRoute component
  // This is just to help with SEO and initial page load
  return {
    props: {}
  }
}

export default function Account () {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'campaigns' | 'analytics' | 'notifications' | 'settings'
  >('campaigns')

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>({
      yieldEarned: true,
      campaignUpdates: true,
      refundAvailable: true,
      emailNotifications: false
    })

  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    email: '',
    bio: ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)
  const [showYieldChart, setShowYieldChart] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Updated campaigns data with three different scenarios
  const campaigns: Campaign[] = [
    {
      id: '1',
      name: 'Save the Oceans',
      description:
        'Ocean cleanup and conservation initiative - Currently generating yield',
      totalContributed: 1500,
      yieldEarned: 45.5,
      hasClaimableYield: false,
      refundEligible: false,
      status: 'active',
      contributions: [
        {
          date: '2024-02-01',
          amount: 1000,
          yieldEarned: 30.5,
          txHash: '0x123...abc',
          apy: 12.5
        },
        {
          date: '2024-02-15',
          amount: 500,
          yieldEarned: 15.0,
          txHash: '0x456...def',
          apy: 12.8
        }
      ]
    },
    {
      id: '2',
      name: 'Green Energy Initiative',
      description:
        'Successfully completed renewable energy project - Claim your yield',
      totalContributed: 1800,
      yieldEarned: 55.0,
      hasClaimableYield: true,
      refundEligible: false,
      status: 'successful',
      contributions: [
        {
          date: '2024-01-15',
          amount: 1800,
          yieldEarned: 55.0,
          txHash: '0x789...ghi',
          apy: 13.2
        }
      ]
    },
    {
      id: '3',
      name: 'Education for All',
      description: 'Campaign unsuccessful - Claim yield and request refund',
      totalContributed: 2000,
      yieldEarned: 25.0,
      hasClaimableYield: true,
      refundEligible: true,
      status: 'unsuccessful',
      contributions: [
        {
          date: '2024-01-01',
          amount: 1200,
          yieldEarned: 15.0,
          txHash: '0xabc...123',
          apy: 11.5
        },
        {
          date: '2024-01-10',
          amount: 800,
          yieldEarned: 10.0,
          txHash: '0xdef...456',
          apy: 11.8
        }
      ]
    }
  ]

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleProfileChange = (key: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSavedMessage('Settings saved successfully!')
    setTimeout(() => setSavedMessage(''), 3000)
    setIsSaving(false)
  }

  const getYieldChartData = (contributions: Contribution[]) => {
    let cumulativeYield = 0
    return contributions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(contribution => {
        cumulativeYield += contribution.yieldEarned
        return {
          date: contribution.date,
          yield: cumulativeYield,
          rate: contribution.apy
        }
      })
  }

  const getStatusBadgeColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'successful':
        return 'bg-blue-100 text-blue-800'
      case 'unsuccessful':
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = (campaign: Campaign) => {
    switch (campaign.status) {
      case 'active':
        return 'Generating Yield'
      case 'successful':
        return campaign.hasClaimableYield ? 'Claim Yield' : 'Completed'
      case 'unsuccessful':
        return 'Claim Yield & Refund'
    }
  }

  const handleClaimYield = async (campaignId: string) => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
    // Add success notification logic here
  }

  const handleRequestRefund = async (campaignId: string) => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
    // Add success notification logic here
  }

  const getTotalYieldChartData = (campaigns: Campaign[]) => {
    // Collect all contributions and sort by date
    const allContributions = campaigns
      .flatMap(campaign => campaign.contributions)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let cumulativeYield = 0
    return allContributions.map(contribution => {
      cumulativeYield += contribution.yieldEarned
      return {
        date: new Date(contribution.date).toLocaleDateString(),
        yield: cumulativeYield
      }
    })
  }

  const renderCampaignsList = () => (
    <div className='space-y-6'>
      {campaigns.map(campaign => (
        <div
          key={campaign.id}
          onClick={() =>
            setExpandedCampaign(
              expandedCampaign === campaign.id ? null : campaign.id
            )
          }
          className='bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer'
        >
          <div className='p-6'>
            <div className='flex items-center justify-between'>
              <div className='flex-1'>
                <div className='flex items-center space-x-3'>
                  <h3 className='text-lg font-medium text-gray-900'>
                    {campaign.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                      campaign.status
                    )}`}
                  >
                    {getStatusText(campaign)}
                  </span>
                </div>
                <p className='text-sm text-gray-500 mt-1'>
                  {campaign.description}
                </p>
              </div>
              <div className='text-gray-400'>
                {expandedCampaign === campaign.id ? (
                  <ChevronUpIcon className='w-5 h-5' />
                ) : (
                  <ChevronDownIcon className='w-5 h-5' />
                )}
              </div>
            </div>

            <div className='mt-4 grid grid-cols-3 gap-4'>
              <div>
                <p className='text-sm text-gray-500'>Total Contributed</p>
                <p className='text-lg font-semibold'>
                  ${campaign.totalContributed}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>Yield Earned</p>
                <p className='text-lg font-semibold'>${campaign.yieldEarned}</p>
              </div>
              <div>
                <p className='text-sm text-gray-500'>Contributions</p>
                <p className='text-lg font-semibold'>
                  {campaign.contributions.length}
                </p>
              </div>
            </div>

            {/* Campaign Actions */}
            {(campaign.hasClaimableYield || campaign.refundEligible) && (
              <div className='mt-4 flex space-x-4'>
                {campaign.hasClaimableYield && (
                  <button
                    onClick={e => {
                      e.stopPropagation() // Prevent container click
                      handleClaimYield(campaign.id)
                    }}
                    disabled={isLoading}
                    className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
                  >
                    Claim Yield
                  </button>
                )}
                {campaign.refundEligible && (
                  <button
                    onClick={e => {
                      e.stopPropagation() // Prevent container click
                      handleRequestRefund(campaign.id)
                    }}
                    disabled={isLoading}
                    className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50'
                  >
                    Request Refund
                  </button>
                )}
              </div>
            )}

            {expandedCampaign === campaign.id && (
              <div className='mt-6 border-t pt-4'>
                <div className='flex justify-between items-center mb-4'>
                  <h4 className='text-sm font-medium text-gray-900'>
                    Contribution History
                  </h4>
                  <button
                    onClick={e => {
                      e.stopPropagation() // Prevent container click
                      setShowYieldChart(
                        showYieldChart === campaign.id ? null : campaign.id
                      )
                    }}
                    className='text-sm text-blue-600 hover:text-blue-700'
                  >
                    {showYieldChart === campaign.id
                      ? 'Hide Yield Chart'
                      : 'Show Yield Chart'}
                  </button>
                </div>

                {showYieldChart === campaign.id && (
                  <div className='mb-6 h-64'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart
                        data={getYieldChartData(campaign.contributions)}
                      >
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='date' />
                        <YAxis yAxisId='left' />
                        <YAxis yAxisId='right' orientation='right' />
                        <Tooltip />
                        <Line
                          yAxisId='left'
                          type='monotone'
                          dataKey='yield'
                          stroke='#2563eb'
                          name='Yield Earned'
                        />
                        <Line
                          yAxisId='right'
                          type='monotone'
                          dataKey='rate'
                          stroke='#16a34a'
                          name='APY'
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className='overflow-x-auto'>
                  <table className='min-w-full divide-y divide-gray-200'>
                    <thead>
                      <tr>
                        <th className='px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Date
                        </th>
                        <th className='px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Amount
                        </th>
                        <th className='px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Yield Earned
                        </th>
                        <th className='px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          APY
                        </th>
                        <th className='px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                          Transaction
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {campaign.contributions.map((contribution, idx) => (
                        <tr key={idx}>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            {new Date(contribution.date).toLocaleDateString()}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            ${contribution.amount}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            ${contribution.yieldEarned}
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            {contribution.apy}%
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                            <a
                              href={`https://etherscan.io/tx/${contribution.txHash}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-600 hover:text-blue-700 inline-flex items-center'
                            >
                              {contribution.txHash.slice(0, 6)}...
                              {contribution.txHash.slice(-4)}
                              <ArrowTopRightOnSquareIcon className='w-4 h-4 ml-1' />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const renderYieldAnalytics = () => {
    // Calculate aggregate metrics
    const totalYieldGenerated = campaigns.reduce(
      (sum, campaign) => sum + campaign.yieldEarned,
      0
    )
    const totalContributed = campaigns.reduce(
      (sum, campaign) => sum + campaign.totalContributed,
      0
    )

    // Calculate weighted average APY
    const totalWeightedAPY = campaigns.reduce((sum, campaign) => {
      const latestAPY =
        campaign.contributions[campaign.contributions.length - 1]?.apy || 0
      return sum + latestAPY * campaign.totalContributed
    }, 0)
    const averageAPY = totalWeightedAPY / totalContributed

    // Calculate total number of contributions
    const totalContributions = campaigns.reduce(
      (sum, campaign) => sum + campaign.contributions.length,
      0
    )

    return (
      <div className='space-y-6'>
        {/* Aggregate Metrics */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white rounded-lg shadow p-4'>
            <p className='text-sm text-gray-500'>Total Yield Generated</p>
            <p className='text-2xl font-bold text-blue-600'>
              ${totalYieldGenerated.toFixed(2)}
            </p>
            <p className='text-xs text-gray-400 mt-1'>Across all campaigns</p>
          </div>
          <div className='bg-white rounded-lg shadow p-4'>
            <p className='text-sm text-gray-500'>Average APY</p>
            <p className='text-2xl font-bold text-green-600'>
              {averageAPY.toFixed(2)}%
            </p>
            <p className='text-xs text-gray-400 mt-1'>
              Weighted by contribution
            </p>
          </div>
          <div className='bg-white rounded-lg shadow p-4'>
            <p className='text-sm text-gray-500'>Total Contributed</p>
            <p className='text-2xl font-bold text-indigo-600'>
              ${totalContributed}
            </p>
            <p className='text-xs text-gray-400 mt-1'>Principal amount</p>
          </div>
          <div className='bg-white rounded-lg shadow p-4'>
            <p className='text-sm text-gray-500'>Total Contributions</p>
            <p className='text-2xl font-bold text-purple-600'>
              {totalContributions}
            </p>
            <p className='text-xs text-gray-400 mt-1'>Number of deposits</p>
          </div>
        </div>

        {/* Total Yield Growth Chart */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>
            Total Yield Growth
          </h3>
          <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={getTotalYieldChartData(campaigns)}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 12 }}
                  tickFormatter={value =>
                    new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })
                  }
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={value => `$${value}`}
                />
                <Tooltip
                  formatter={value => [`$${value}`, 'Total Yield']}
                  labelFormatter={label => `Date: ${label}`}
                />
                <Line
                  type='monotone'
                  dataKey='yield'
                  stroke='#2563eb'
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name='Total Yield'
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  // Don't render anything until client-side hydration is complete
  if (!mounted) {
    return null
  }

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold'>Account</h1>
            <p className='text-gray-600 mt-2'>
              {address
                ? `Welcome back, ${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Connect your wallet to view your account'}
            </p>
          </div>

          {/* Overview Cards */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
            <div className='bg-white rounded-lg shadow p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-500'>Total Contributed</p>
                  <p className='text-2xl font-bold'>$3,300</p>
                </div>
                <div className='text-blue-500'>
                  <FolderIcon className='w-8 h-8' />
                </div>
              </div>
            </div>

            <div className='bg-white rounded-lg shadow p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-500'>Total Yield Earned</p>
                  <p className='text-2xl font-bold'>$100.5</p>
                </div>
                <div className='text-green-500'>
                  <ChartBarIcon className='w-8 h-8' />
                </div>
              </div>
            </div>

            <div className='bg-white rounded-lg shadow p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-500'>Unread Notifications</p>
                  <p className='text-2xl font-bold'>1</p>
                </div>
                <div className='text-yellow-500'>
                  <BellIcon className='w-8 h-8' />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className='bg-white rounded-lg shadow'>
            <div className='border-b border-gray-200'>
              <nav className='flex space-x-8 px-6' aria-label='Tabs'>
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
                    Supported Campaigns
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'analytics'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <ChartBarIcon className='w-5 h-5 mr-2' />
                    Yield Analytics
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'notifications'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <BellIcon className='w-5 h-5 mr-2' />
                    Notifications
                  </div>
                </button>

                {address && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'settings'
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-blue-50'
                    } rounded-t-lg flex items-center space-x-2`}
                  >
                    <div className='flex items-center'>
                      <UserCircleIcon className='w-5 h-5 mr-2' />
                      <span>Account</span>
                      <WalletIcon className='w-4 h-4 ml-2 text-blue-500' />
                    </div>
                  </button>
                )}
              </nav>
            </div>

            <div className='p-6'>
              {/* Supported Campaigns Tab */}
              {activeTab === 'campaigns' && (
                <div>
                  <h2 className='text-xl font-semibold mb-4'>
                    Your Supported Campaigns
                  </h2>
                  {renderCampaignsList()}
                </div>
              )}

              {/* Yield Analytics Tab */}
              {activeTab === 'analytics' && (
                <div>
                  <h2 className='text-xl font-semibold mb-4'>
                    Yield Analytics
                  </h2>
                  {renderYieldAnalytics()}
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className='space-y-6'>
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Yield Earned
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Get notified when you earn yield from your
                          contributions
                        </p>
                      </div>
                      <button
                        onClick={() => handleNotificationToggle('yieldEarned')}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.yieldEarned
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.yieldEarned
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Campaign Updates
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Receive updates about campaigns you've supported
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleNotificationToggle('campaignUpdates')
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.campaignUpdates
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.campaignUpdates
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Refund Available
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Get notified when refunds become available
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleNotificationToggle('refundAvailable')
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.refundAvailable
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.refundAvailable
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Email Notifications
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Receive notifications via email
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleNotificationToggle('emailNotifications')
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.emailNotifications
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.emailNotifications
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Settings Tab */}
              {activeTab === 'settings' && (
                <div className='space-y-6'>
                  <div>
                    <label
                      htmlFor='displayName'
                      className='block text-sm font-medium text-gray-700'
                    >
                      Display Name
                    </label>
                    <input
                      type='text'
                      id='displayName'
                      value={profile.displayName}
                      onChange={e =>
                        handleProfileChange('displayName', e.target.value)
                      }
                      className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                      placeholder='Enter your display name'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='email'
                      className='block text-sm font-medium text-gray-700'
                    >
                      Email Address
                    </label>
                    <input
                      type='email'
                      id='email'
                      value={profile.email}
                      onChange={e =>
                        handleProfileChange('email', e.target.value)
                      }
                      className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                      placeholder='Enter your email'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='bio'
                      className='block text-sm font-medium text-gray-700'
                    >
                      Bio
                    </label>
                    <textarea
                      id='bio'
                      rows={3}
                      value={profile.bio}
                      onChange={e => handleProfileChange('bio', e.target.value)}
                      className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                      placeholder='Tell us about yourself'
                    />
                  </div>

                  <div className='border-t pt-4'>
                    <h3 className='text-sm font-medium text-gray-900 mb-4'>
                      Security Tips
                    </h3>
                    <ul className='space-y-2 text-sm text-gray-600'>
                      <li>• Never share your private keys or seed phrase</li>
                      <li>
                        • Always verify transaction details before signing
                      </li>
                      <li>• Be cautious of phishing attempts</li>
                      <li>
                        • Consider using a hardware wallet for added security
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Save Button for Settings and Notifications */}
              {(activeTab === 'settings' || activeTab === 'notifications') && (
                <div className='mt-6 flex items-center justify-end space-x-4'>
                  {savedMessage && (
                    <div className='flex items-center text-green-600'>
                      <CheckCircleIcon className='w-5 h-5 mr-2' />
                      <span>{savedMessage}</span>
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
