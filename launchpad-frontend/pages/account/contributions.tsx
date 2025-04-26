import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { formatNumber } from '../../utils/format'
import { formatDistanceToNow } from 'date-fns'
import { RocketLaunchIcon } from '@heroicons/react/24/outline'
import { doc, getDoc } from 'firebase/firestore'
import Link from 'next/link'

interface ContributionEvent {
  campaignId: string
  contributor: string
  amount: string
  blockNumber: number
  blockTimestamp: Date
  transactionHash: string
  tokenAddress: string
}

interface Campaign {
  id: string
  title: string
  description: string
  status: number
  statusText: string
  token: string
}

export default function UserContributions() {
  const { address, isConnected } = useAccount()
  const [contributionEvents, setContributionEvents] = useState<ContributionEvent[]>([])
  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({})
  const [isLoading, setIsLoading] = useState(true)
  const { getTokenByAddress } = useTokens()
  const [mounted, setMounted] = useState(false)

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchContributions = async () => {
      if (!address) return

      try {
        setIsLoading(true)
        const contributionEventsRef = collection(db, 'contributionEvents')
        const q = query(
          contributionEventsRef,
          where('contributor', '==', address.toLowerCase()),
          orderBy('blockTimestamp', 'desc')
        )
        const querySnapshot = await getDocs(q)

        const events = querySnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            campaignId: data.campaignId,
            contributor: data.contributor,
            amount: data.amount,
            blockNumber: data.blockNumber,
            blockTimestamp: data.blockTimestamp.toDate(),
            transactionHash: data.transactionHash,
            tokenAddress: data.token
          }
        })

        setContributionEvents(events)

        // Fetch campaign details for each contribution
        const campaignPromises = events.map(async (event) => {
          const campaignRef = doc(db, 'campaigns', event.campaignId)
          const campaignSnap = await getDoc(campaignRef)
          if (campaignSnap.exists()) {
            const data = campaignSnap.data()
            return {
              id: campaignSnap.id,
              ...data,
              token: data.token
            } as Campaign
          }
          return null
        })

        const campaignResults = await Promise.all(campaignPromises)
        const campaignMap = campaignResults.reduce((acc, campaign) => {
          if (campaign) {
            acc[campaign.id] = campaign
          }
          return acc
        }, {} as Record<string, Campaign>)

        setCampaigns(campaignMap)
      } catch (error) {
        console.error('Error fetching contributions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (mounted) {
      fetchContributions()
    }
  }, [address, mounted])

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

  const calculateStats = () => {
    if (!mounted) return { totalContributions: 0, uniqueCampaigns: 0, tokenStats: [] }
    
    const uniqueCampaigns = new Set(contributionEvents.map(event => event.campaignId))
    
    // Group contributions by token to sum amounts correctly
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

    // Calculate total contributed for each token
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
  }

  if (!mounted) {
    return null // Prevent flash of incorrect content during hydration
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

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <RocketLaunchIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Your Contributions</h1>
          </div>

          {contributionEvents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <dt className="text-sm font-medium text-gray-500">Total Contributions</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{stats.totalContributions}</dd>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6">
                <dt className="text-sm font-medium text-gray-500">Unique Campaigns</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{stats.uniqueCampaigns}</dd>
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
                {contributionEvents.map((event) => {
                  const campaign = campaigns[event.campaignId]
                  const token = getTokenByAddress(campaign?.token || '')
                  
                  return (
                    <li key={event.transactionHash} className="relative pb-8">
                      <div className="relative flex items-start space-x-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            <Link 
                              href={`/campaigns/${event.campaignId}`}
                              className="font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1"
                            >
                              {campaign?.title || 'Unknown Campaign'}
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </Link>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {mounted && (
                                <>
                                  Contributed {formatAmount(event.amount, campaign?.token || '')} {token?.symbol || 'tokens'} • {formatDistanceToNow(event.blockTimestamp, { addSuffix: true })}
                                </>
                              )}
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
                        <div className="flex-shrink-0 self-center">
                          <div className="text-sm text-gray-500">
                            Block #{event.blockNumber}
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