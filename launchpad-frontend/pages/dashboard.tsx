import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import {
  BellIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarSquareIcon
} from '@heroicons/react/24/outline'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import ProtectedRoute from '../components/auth/ProtectedRoute'

interface Campaign {
  id: string
  name: string
  totalContributed: number
  contributions: Contribution[]
  status: 'active' | 'completed' | 'failed'
  goalReached: boolean
  hasClaimableYield: boolean
  refundEligible: boolean
  yieldEarned: number
  endDate: string
}

interface Contribution {
  id: string
  campaignId: string
  amount: number
  timestamp: string
  yieldEarned: number
  txHash: string
  yieldRate: number // APY at time of contribution
}

interface Notification {
  id: string
  type: 'yield' | 'campaign' | 'system'
  message: string
  timestamp: string
  read: boolean
}

type SortField = 'date' | 'amount' | 'yield'
type SortDirection = 'asc' | 'desc'

interface ChartDataPoint {
  date: string
  yield: number
  rate: number
}

const YieldChart = ({ contributions }: { contributions: Contribution[] }) => {
  const chartData: ChartDataPoint[] = useMemo(() => {
    return contributions
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map(contribution => ({
        date: new Date(contribution.timestamp).toLocaleDateString(),
        yield: contribution.yieldEarned,
        rate: contribution.yieldRate
      }))
  }, [contributions])

  return (
    <div className='h-full w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5
          }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='date' tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId='left'
            tick={{ fontSize: 12 }}
            label={{
              value: 'Yield Earned ($)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <YAxis
            yAxisId='right'
            orientation='right'
            tick={{ fontSize: 12 }}
            label={{
              value: 'APY (%)',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'yield'
                ? `$${value.toFixed(2)}`
                : `${value.toFixed(2)}%`,
              name === 'yield' ? 'Yield Earned' : 'APY'
            ]}
          />
          <Line
            yAxisId='left'
            type='monotone'
            dataKey='yield'
            stroke='#10B981'
            name='yield'
            strokeWidth={2}
            dot={{ fill: '#10B981' }}
          />
          <Line
            yAxisId='right'
            type='monotone'
            dataKey='rate'
            stroke='#3B82F6'
            name='rate'
            strokeWidth={2}
            dot={{ fill: '#3B82F6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const AggregatedYieldChart = ({ campaigns }: { campaigns: Campaign[] }) => {
  const chartData = useMemo(() => {
    // Collect all contributions and sort by date
    const allContributions = campaigns
      .flatMap(campaign => campaign.contributions)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

    // Calculate cumulative yield
    let cumulativeYield = 0
    return allContributions.map(contribution => {
      cumulativeYield += contribution.yieldEarned
      return {
        date: new Date(contribution.timestamp).toLocaleDateString(),
        cumulativeYield: cumulativeYield,
        yieldAdded: contribution.yieldEarned,
        rate: contribution.yieldRate
      }
    })
  }, [campaigns])

  return (
    <div className='h-[400px] w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5
          }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='date' tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId='left'
            tick={{ fontSize: 12 }}
            label={{
              value: 'Cumulative Yield ($)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12 }
            }}
          />
          <YAxis
            yAxisId='right'
            orientation='right'
            tick={{ fontSize: 12 }}
            label={{
              value: 'Yield per Contribution ($)',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 12 }
            }}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
            labelFormatter={label => `Date: ${label}`}
          />
          <Line
            yAxisId='left'
            type='monotone'
            dataKey='cumulativeYield'
            stroke='#10B981'
            name='Total Yield'
            strokeWidth={2}
            dot={{ fill: '#10B981' }}
          />
          <Line
            yAxisId='right'
            type='monotone'
            dataKey='yieldAdded'
            stroke='#3B82F6'
            name='Yield per Contribution'
            strokeWidth={2}
            dot={{ fill: '#3B82F6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Dashboard () {
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<
    'overview' | 'yield' | 'notifications'
  >('overview')
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isLoading, setIsLoading] = useState(false)
  const [showYieldChart, setShowYieldChart] = useState<string | null>(null)

  const getStatusBadges = (campaign: Campaign) => {
    const badges = []

    if (campaign.hasClaimableYield) {
      badges.push(
        <span
          key='yield'
          className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2'
        >
          <CheckCircleIcon className='w-4 h-4 mr-1' />
          Yield Available
        </span>
      )
    }

    if (campaign.refundEligible) {
      badges.push(
        <span
          key='refund'
          className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2'
        >
          <XCircleIcon className='w-4 h-4 mr-1' />
          Refund Available
        </span>
      )
    }

    if (!campaign.hasClaimableYield && !campaign.refundEligible) {
      badges.push(
        <span
          key='generating'
          className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
        >
          <ClockIcon className='w-4 h-4 mr-1' />
          Generating Yield
        </span>
      )
    }

    return <div className='flex flex-wrap gap-2'>{badges}</div>
  }

  const toggleCampaignDetails = (campaignId: string) => {
    setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortedContributions = (contributions: Contribution[]) => {
    return [...contributions].sort((a, b) => {
      if (sortField === 'date') {
        return sortDirection === 'asc'
          ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      if (sortField === 'amount') {
        return sortDirection === 'asc'
          ? a.amount - b.amount
          : b.amount - a.amount
      }
      // yield
      return sortDirection === 'asc'
        ? a.yieldEarned - b.yieldEarned
        : b.yieldEarned - a.yieldEarned
    })
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ArrowUpIcon className='w-4 h-4 ml-1' />
    ) : (
      <ArrowDownIcon className='w-4 h-4 ml-1' />
    )
  }

  // Sample data updated to show the three main scenarios
  const campaigns: Campaign[] = [
    {
      id: '1',
      name: 'Save the Oceans',
      totalContributed: 1000,
      contributions: [
        {
          id: '1a',
          campaignId: '1',
          amount: 500,
          timestamp: '2024-03-10',
          yieldEarned: 8.5,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 4.25
        },
        {
          id: '1b',
          campaignId: '1',
          amount: 500,
          timestamp: '2024-03-15',
          yieldEarned: 5.0,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 2.5
        }
      ],
      status: 'active',
      goalReached: false,
      hasClaimableYield: false,
      refundEligible: false,
      yieldEarned: 13.5,
      endDate: '2024-06-15'
    },
    {
      id: '2',
      name: 'Green Energy Initiative',
      totalContributed: 2000,
      contributions: [
        {
          id: '2a',
          campaignId: '2',
          amount: 1000,
          timestamp: '2024-02-01',
          yieldEarned: 45.75,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 22.875
        },
        {
          id: '2b',
          campaignId: '2',
          amount: 500,
          timestamp: '2024-02-15',
          yieldEarned: 20.25,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 10.125
        },
        {
          id: '2c',
          campaignId: '2',
          amount: 500,
          timestamp: '2024-03-01',
          yieldEarned: 15.5,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 7.75
        }
      ],
      status: 'completed',
      goalReached: true,
      hasClaimableYield: true,
      refundEligible: false,
      yieldEarned: 81.5,
      endDate: '2024-03-01'
    },
    {
      id: '3',
      name: 'Education for All',
      totalContributed: 300,
      contributions: [
        {
          id: '3a',
          campaignId: '3',
          amount: 300,
          timestamp: '2024-03-05',
          yieldEarned: 5.5,
          txHash:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          yieldRate: 1.8333
        }
      ],
      status: 'failed',
      goalReached: false,
      hasClaimableYield: true,
      refundEligible: true,
      yieldEarned: 5.5,
      endDate: '2024-03-10'
    }
  ]

  const notifications: Notification[] = [
    {
      id: '1',
      type: 'yield',
      message: 'You earned 2.5 USDC yield from Save the Oceans campaign',
      timestamp: '2024-03-15T10:00:00Z',
      read: false
    },
    {
      id: '2',
      type: 'campaign',
      message: 'Green Energy Initiative reached its funding goal!',
      timestamp: '2024-03-14T15:30:00Z',
      read: true
    }
  ]

  const totalContributed = campaigns.reduce(
    (sum, c) => sum + c.totalContributed,
    0
  )
  const totalYieldEarned = campaigns.reduce((sum, c) => sum + c.yieldEarned, 0)
  const unreadNotifications = notifications.filter(n => !n.read).length

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='container mx-auto px-4'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold mb-2'>Dashboard</h1>
            <p className='text-gray-600'>
              Welcome back,{' '}
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </p>
          </div>

          {/* Stats Overview */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 mb-1'>Total Contributed</p>
                  <p className='text-2xl font-bold'>
                    ${totalContributed.toLocaleString()}
                  </p>
                </div>
                <CurrencyDollarIcon className='h-8 w-8 text-blue-500' />
              </div>
            </div>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 mb-1'>Total Yield Earned</p>
                  <p className='text-2xl font-bold'>
                    ${totalYieldEarned.toLocaleString()}
                  </p>
                </div>
                <ChartBarIcon className='h-8 w-8 text-green-500' />
              </div>
            </div>
            <div className='bg-white rounded-lg shadow-sm p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 mb-1'>Unread Notifications</p>
                  <p className='text-2xl font-bold'>{unreadNotifications}</p>
                </div>
                <BellIcon className='h-8 w-8 text-yellow-500' />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className='bg-white rounded-lg shadow-sm mb-8'>
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
                  Supported Campaigns
                </button>
                <button
                  onClick={() => setActiveTab('yield')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'yield'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Yield Analytics
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'notifications'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Notifications
                </button>
              </nav>
            </div>

            <div className='p-6'>
              {activeTab === 'overview' && (
                <div className='space-y-6'>
                  <h3 className='text-lg font-medium'>
                    Your Supported Campaigns
                  </h3>
                  <div className='space-y-4'>
                    {campaigns.map(campaign => (
                      <div
                        key={campaign.id}
                        className='bg-white border rounded-lg p-6'
                      >
                        <div className='flex justify-between items-start mb-4'>
                          <div>
                            <h4 className='text-lg font-medium mb-1'>
                              {campaign.name}
                            </h4>
                            <p className='text-sm text-gray-500'>
                              Campaign ends:{' '}
                              {new Date(campaign.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadges(campaign)}
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                          <div>
                            <p className='text-sm text-gray-500'>
                              Total Contributed
                            </p>
                            <p className='text-lg font-medium'>
                              ${campaign.totalContributed.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className='text-sm text-gray-500'>
                              Yield Earned
                            </p>
                            <p className='text-lg font-medium text-green-600'>
                              ${campaign.yieldEarned.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className='text-sm text-gray-500'>
                              Number of Contributions
                            </p>
                            <p className='text-lg font-medium'>
                              {campaign.contributions.length}
                            </p>
                          </div>
                        </div>

                        {/* Contribution Details Section */}
                        <div className='mt-4 border-t pt-4'>
                          <button
                            onClick={() => toggleCampaignDetails(campaign.id)}
                            className='flex items-center text-sm text-gray-600 hover:text-gray-900'
                          >
                            {expandedCampaign === campaign.id ? (
                              <>
                                <ChevronUpIcon className='w-4 h-4 mr-1' />
                                Hide Contribution Details
                              </>
                            ) : (
                              <>
                                <ChevronDownIcon className='w-4 h-4 mr-1' />
                                View Contribution Details
                              </>
                            )}
                          </button>

                          {expandedCampaign === campaign.id && (
                            <div className='mt-4 space-y-4'>
                              <div className='bg-gray-50 rounded-lg p-4'>
                                <div className='flex justify-between items-center mb-4'>
                                  <h4 className='text-sm font-medium text-gray-900'>
                                    Contribution History
                                  </h4>
                                  <button
                                    onClick={() =>
                                      setShowYieldChart(
                                        showYieldChart === campaign.id
                                          ? null
                                          : campaign.id
                                      )
                                    }
                                    className='flex items-center text-sm text-blue-600 hover:text-blue-800'
                                  >
                                    <ChartBarSquareIcon className='w-4 h-4 mr-1' />
                                    {showYieldChart === campaign.id
                                      ? 'Hide Yield Chart'
                                      : 'Show Yield Chart'}
                                  </button>
                                </div>

                                {showYieldChart === campaign.id && (
                                  <div className='h-64 bg-white rounded-lg p-4 mb-4'>
                                    <YieldChart
                                      contributions={campaign.contributions}
                                    />
                                  </div>
                                )}

                                <div className='overflow-x-auto'>
                                  <table className='min-w-full'>
                                    <thead>
                                      <tr>
                                        <th
                                          className='text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 cursor-pointer hover:text-gray-700'
                                          onClick={() => toggleSort('date')}
                                        >
                                          <div className='flex items-center'>
                                            Date {getSortIcon('date')}
                                          </div>
                                        </th>
                                        <th
                                          className='text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 cursor-pointer hover:text-gray-700'
                                          onClick={() => toggleSort('amount')}
                                        >
                                          <div className='flex items-center'>
                                            Amount {getSortIcon('amount')}
                                          </div>
                                        </th>
                                        <th
                                          className='text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2 cursor-pointer hover:text-gray-700'
                                          onClick={() => toggleSort('yield')}
                                        >
                                          <div className='flex items-center'>
                                            Yield Earned {getSortIcon('yield')}
                                          </div>
                                        </th>
                                        <th className='text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2'>
                                          APY at Time
                                        </th>
                                        <th className='text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2'>
                                          Transaction
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className='divide-y divide-gray-200'>
                                      {isLoading ? (
                                        <tr>
                                          <td
                                            colSpan={5}
                                            className='py-4 text-center'
                                          >
                                            <div className='flex items-center justify-center'>
                                              <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600'></div>
                                              <span className='ml-2 text-gray-600'>
                                                Loading contributions...
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : (
                                        getSortedContributions(
                                          campaign.contributions
                                        ).map(contribution => (
                                          <tr key={contribution.id}>
                                            <td className='py-2 text-sm text-gray-900'>
                                              {new Date(
                                                contribution.timestamp
                                              ).toLocaleString()}
                                            </td>
                                            <td className='py-2 text-sm text-gray-900'>
                                              $
                                              {contribution.amount.toLocaleString()}
                                            </td>
                                            <td className='py-2 text-sm text-green-600'>
                                              $
                                              {contribution.yieldEarned.toLocaleString()}
                                            </td>
                                            <td className='py-2 text-sm text-blue-600'>
                                              {contribution.yieldRate.toFixed(
                                                2
                                              )}
                                              %
                                            </td>
                                            <td className='py-2 text-sm text-gray-900'>
                                              <a
                                                href={`https://etherscan.io/tx/${contribution.txHash}`}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className='flex items-center text-blue-600 hover:text-blue-800'
                                              >
                                                {contribution.txHash.slice(
                                                  0,
                                                  6
                                                )}
                                                ...
                                                {contribution.txHash.slice(-4)}
                                                <ArrowTopRightOnSquareIcon className='w-4 h-4 ml-1' />
                                              </a>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className='mt-4 flex justify-end space-x-4'>
                          {campaign.hasClaimableYield && (
                            <button className='bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-600 transition-colors'>
                              Claim Yield
                            </button>
                          )}
                          {campaign.refundEligible && (
                            <button className='bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition-colors'>
                              Request Refund
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'yield' && (
                <div className='space-y-6'>
                  <h3 className='text-lg font-medium'>Yield Analytics</h3>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='bg-gray-50 rounded-lg p-6'>
                      <h4 className='text-sm font-medium text-gray-500 mb-2'>
                        Total Yield Generated
                      </h4>
                      <p className='text-3xl font-bold text-green-600'>
                        ${totalYieldEarned.toLocaleString()}
                      </p>
                    </div>
                    <div className='bg-gray-50 rounded-lg p-6'>
                      <h4 className='text-sm font-medium text-gray-500 mb-2'>
                        Average APY
                      </h4>
                      <p className='text-3xl font-bold text-blue-600'>4.5%</p>
                    </div>
                  </div>

                  <div className='bg-white rounded-lg p-6 border'>
                    <h4 className='text-sm font-medium text-gray-900 mb-4'>
                      Yield Growth Over Time
                    </h4>
                    <AggregatedYieldChart campaigns={campaigns} />
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {campaigns.map(campaign => (
                      <div
                        key={campaign.id}
                        className='bg-gray-50 rounded-lg p-4'
                      >
                        <h5 className='font-medium mb-2'>{campaign.name}</h5>
                        <div className='space-y-2'>
                          <div className='flex justify-between'>
                            <span className='text-sm text-gray-500'>
                              Contributed
                            </span>
                            <span className='text-sm font-medium'>
                              ${campaign.totalContributed.toLocaleString()}
                            </span>
                          </div>
                          <div className='flex justify-between'>
                            <span className='text-sm text-gray-500'>
                              Yield Earned
                            </span>
                            <span className='text-sm font-medium text-green-600'>
                              ${campaign.yieldEarned.toLocaleString()}
                            </span>
                          </div>
                          <div className='flex justify-between'>
                            <span className='text-sm text-gray-500'>
                              Current APY
                            </span>
                            <span className='text-sm font-medium text-blue-600'>
                              {(
                                campaign.contributions[
                                  campaign.contributions.length - 1
                                ]?.yieldRate || 0
                              ).toFixed(2)}
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className='space-y-6'>
                  <h3 className='text-lg font-medium'>Recent Notifications</h3>
                  <div className='space-y-4'>
                    {notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg ${
                          notification.read
                            ? 'bg-gray-50'
                            : 'bg-blue-50 border-l-4 border-blue-500'
                        }`}
                      >
                        <div className='flex justify-between items-start'>
                          <div>
                            <p className='text-sm text-gray-900'>
                              {notification.message}
                            </p>
                            <p className='text-xs text-gray-500 mt-1'>
                              {new Date(
                                notification.timestamp
                              ).toLocaleString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
