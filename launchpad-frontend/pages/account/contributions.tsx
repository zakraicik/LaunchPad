import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { formatNumber } from '../../utils/format'
import { formatDistanceToNow } from 'date-fns'
import { WalletIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import useRefundStatuses from '../../hooks/campaigns/useRefundStatuses'
import { useContributions, Campaign, ContributionEvent } from '../../hooks/campaigns/useContributions'
import { useHydration } from '../../pages/_app'

export default function UserContributions() {
  const { isHydrated } = useHydration()
  const { address, isConnected } = useAccount()
  const { getTokenByAddress } = useTokens()
  const [statusFilter, setStatusFilter] = useState<string>('All')
  
  // Only fetch data when component is hydrated
  const { data: contributionsData, isLoading } = useContributions(
    isHydrated ? address : undefined
  )
  
  const contributionEvents = contributionsData?.contributionEvents || []
  const campaigns = contributionsData?.campaigns || {}

  // Memoize getCampaignStatus function
  const getCampaignStatus = useMemo(() => {
    return (campaign: Campaign): string => {
      const isCampaignEnded = (): boolean => {
        if (!campaign.createdAt || !campaign.duration) return false

        let createdAtDate: Date
        if (typeof campaign.createdAt === 'string') {
          createdAtDate = new Date(campaign.createdAt)
        } else if (campaign.createdAt instanceof Date) {
          createdAtDate = campaign.createdAt
        } else {
          createdAtDate = campaign.createdAt.toDate()
        }

        const endDate = new Date(
          createdAtDate.getTime() + parseInt(campaign.duration) * 24 * 60 * 60 * 1000
        )
        return new Date() > endDate
      }

      const isSuccessful = (): boolean => {
        if (!campaign.totalContributions || !campaign.goalAmountSmallestUnits) return false
        try {
          const totalContributions = BigInt(campaign.totalContributions)
          const goalAmount = BigInt(campaign.goalAmountSmallestUnits)
          return totalContributions >= goalAmount
        } catch (error) {
          console.error('Error checking if campaign is successful:', error)
          return false
        }
      }

      if (isSuccessful()) {
        return 'Successful'
      }

      if (!isCampaignEnded()) {
        return 'In Progress'
      }

      return 'Refund Eligible'
    }
  }, [])

  // Memoize campaign statuses calculation
  const campaignStatuses = useMemo(() => {
    const newStatuses: Record<string, string> = {}
    for (const event of contributionEvents) {
      const campaign = campaigns[event.campaignId]
      if (campaign) {
        newStatuses[event.campaignId] = getCampaignStatus(campaign)
      }
    }
    return newStatuses
  }, [contributionEvents, campaigns, getCampaignStatus])

  // Memoize campaignsForRefundCheck
  const campaignsForRefundCheck = useMemo(() => {
    return contributionEvents.map(event => ({
      campaignId: event.campaignId,
      campaignAddress: campaigns[event.campaignId]?.campaignAddress,
      isRefundEligible: campaignStatuses[event.campaignId] === 'Refund Eligible'
    }))
  }, [contributionEvents, campaigns, campaignStatuses])

  // Only fetch refund statuses when component is hydrated and we have campaigns to check
  const refundStatuses = useRefundStatuses(
    isHydrated && campaignsForRefundCheck.length > 0 ? campaignsForRefundCheck : [], 
    isHydrated ? address : undefined
  )

  // Memoize stats calculation
  const stats = useMemo(() => {
    const uniqueCampaigns = new Set(contributionEvents.map(event => event.campaignId))
    
    const contributionsByToken = contributionEvents.reduce((acc, event) => {
      const campaign = campaigns[event.campaignId]
      const tokenAddress = campaign?.token || ''
      if (!acc[tokenAddress]) {
        acc[tokenAddress] = {
          amounts: [],
          count: 0
        }
      }
      acc[tokenAddress].amounts.push(event.amount)
      acc[tokenAddress].count++
      return acc
    }, {} as Record<string, { amounts: string[], count: number }>)

    const tokenStats = Object.entries(contributionsByToken).map(([tokenAddress, data]) => {
      const token = getTokenByAddress(tokenAddress)
      if (!token) return null
      
      const total = data.amounts.reduce((sum, amount) => {
        try {
          const formatted = parseFloat(formatUnits(amount, token.decimals))
          return sum + formatted
        } catch (error) {
          console.error('Error calculating total:', error)
          return sum
        }
      }, 0)

      return {
        symbol: token.symbol,
        total: total.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        count: data.count
      }
    }).filter((stats): stats is { symbol: string; total: string; count: number } => stats !== null)

    return {
      totalContributions: contributionEvents.length,
      uniqueCampaigns: uniqueCampaigns.size,
      tokenStats
    }
  }, [contributionEvents, campaigns, getTokenByAddress])

  const formatAmount = (amount: string, tokenAddress: string) => {
    const token = getTokenByAddress(tokenAddress)
    if (!token) return '0'
    try {
      const formattedAmount = formatUnits(amount, token.decimals)
      return Math.floor(parseFloat(formattedAmount)).toLocaleString()
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Successful':
        return 'bg-green-100 text-green-800'
      case 'Refund Eligible':
        return 'bg-yellow-100 text-yellow-800'
      case 'Refund Received':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAvailableStatuses = () => {
    const statuses = new Set(['All'])
    Object.values(campaignStatuses).forEach(status => {
      if (status) statuses.add(status)
    })
    if (Object.values(refundStatuses).some(status => status)) {
      statuses.add('Refund Received')
    }
    return Array.from(statuses)
  }

  const filterContributions = (events: ContributionEvent[]) => {
    if (statusFilter === 'All') return events

    return events.filter(event => {
      const campaignStatus = campaignStatuses[event.campaignId]
      if (statusFilter === 'Refund Received') {
        return campaignStatus === 'Refund Eligible' && refundStatuses[event.campaignId]
      }
      return campaignStatus === statusFilter
    })
  }

  // Return placeholder during server-side rendering
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Please connect your wallet to view your contributions</div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading your contributions...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between mb-6">
            <div className="flex items-center gap-4">
              <WalletIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Your Contributions</h1>
                <p className="mt-1 text-sm text-gray-500">Track your campaign contributions</p>
              </div>
            </div>
            
            {contributionEvents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {getAvailableStatuses().map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {contributionEvents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <dt className="text-sm font-medium text-gray-500">Total Contributions</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {stats.totalContributions}
                </dd>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <dt className="text-sm font-medium text-gray-500">Unique Campaigns</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {stats.uniqueCampaigns}
                </dd>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <dt className="text-sm font-medium text-gray-500">Contributions by Token</dt>
                <dd className="mt-1">
                  {stats.tokenStats.map(({ symbol, total, count }) => (
                    <div key={symbol} className="mb-2 last:mb-0">
                      <div className="text-2xl font-semibold text-gray-900">
                        {total} {symbol}
                      </div>
                      <div className="text-sm text-gray-500">
                        {count} contribution{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </dd>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {contributionEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">You haven't made any contributions yet</p>
            </div>
          ) : (
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {filterContributions(contributionEvents).map((event) => {
                  const campaign = campaigns[event.campaignId]
                  const token = getTokenByAddress(campaign?.token || '')
                  const isUnsuccessful = campaign?.statusText === 'Unsuccessful'
                  
                  return (
                    <li key={event.transactionHash} className="relative pb-8">
                      <div className="relative flex items-start space-x-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 flex-1">
                                <Link 
                                  href={`/campaigns/${event.campaignId}`}
                                  className="font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1"
                                >
                                  {campaign?.title || 'Unknown Campaign'}
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </Link>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    getStatusColor(
                                      campaignStatuses[event.campaignId] === 'Refund Eligible' && refundStatuses[event.campaignId]
                                        ? 'Refund Received'
                                        : campaignStatuses[event.campaignId]
                                    )
                                  }`}>
                                    {campaignStatuses[event.campaignId] === 'Refund Eligible' && refundStatuses[event.campaignId]
                                      ? 'Refund Received'
                                      : campaignStatuses[event.campaignId] || 'Unknown'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                Block #{event.blockNumber}
                              </div>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500">
                              Contributed {formatAmount(event.amount, campaign?.token || '')} {token?.symbol || 'tokens'} • {formatDistanceToNow(event.blockTimestamp, { addSuffix: true })}
                            </p>
                            <div className="mt-2 text-sm text-gray-500">
                              <a
                                href={`https://basescan.org/tx/${event.transactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View transaction →
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}