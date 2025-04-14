import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import Link from 'next/link'
import { differenceInDays } from 'date-fns'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import CreateCampaignModal from '../../components/campaigns/CreateCampaignModal'

interface Campaign {
  id: string
  title: string
  description: string
  goalAmountSmallestUnits: string
  totalRaised?: string // Optional since it won't exist until first contribution
  token: string
  statusText: string
  statusReasonText?: string
  createdAt: string
  duration: string
  contributors?: number // Optional since it won't exist until first contribution
  imageUrl?: string
}

interface CampaignWithCalculations extends Campaign {
  progress: number
  daysRemaining: number
  formattedRaised: string
  formattedTarget: string
  statusColor: string
}

const calculateDaysRemaining = (createdAt: string, duration: string) => {
  if (!createdAt || !duration) return 0
  const endDate = new Date(
    new Date(createdAt).getTime() + parseInt(duration) * 24 * 60 * 60 * 1000
  )
  const daysRemaining = differenceInDays(endDate, new Date())
  return Math.max(0, daysRemaining)
}

export default function MyCampaigns () {
  const router = useRouter()
  const { address } = useAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [processedCampaigns, setProcessedCampaigns] = useState<
    CampaignWithCalculations[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const { getTokenByAddress } = useTokens()
  const [mounted, setMounted] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Memoize the token getter
  const memoizedGetTokenByAddress = useCallback(getTokenByAddress, [])

  // Process campaigns
  useEffect(() => {
    if (!campaigns.length) return

    const formatAmount = (
      amount: string | undefined,
      tokenAddress: string
    ): string => {
      if (!amount) return '0'
      try {
        const token = memoizedGetTokenByAddress(tokenAddress)
        if (!token) return '0'
        const formatted = formatUnits(amount, token.decimals)
        return Math.floor(parseFloat(formatted)).toLocaleString()
      } catch (error) {
        console.error('Error formatting amount:', error)
        return '0'
      }
    }

    const calculateProgress = (
      raised: string | undefined,
      goal: string,
      tokenAddress: string
    ) => {
      if (!raised) return 0
      try {
        const token = memoizedGetTokenByAddress(tokenAddress)
        if (!token) return 0
        const raisedAmount = parseFloat(formatUnits(raised, token.decimals))
        const goalAmount = parseFloat(formatUnits(goal, token.decimals))
        return (raisedAmount / goalAmount) * 100
      } catch (error) {
        console.error('Error calculating progress:', error)
        return 0
      }
    }

    const processed = campaigns.map(campaign => {
      const daysRemaining = calculateDaysRemaining(
        campaign.createdAt,
        campaign.duration
      )

      return {
        ...campaign,
        progress: calculateProgress(
          campaign.totalRaised,
          campaign.goalAmountSmallestUnits,
          campaign.token
        ),
        daysRemaining,
        formattedRaised: formatAmount(campaign.totalRaised, campaign.token),
        formattedTarget: formatAmount(
          campaign.goalAmountSmallestUnits,
          campaign.token
        ),
        statusColor: getStatusColor(campaign.statusText),
        contributors: campaign.contributors || 0
      }
    })

    setProcessedCampaigns(processed)
  }, [campaigns, memoizedGetTokenByAddress])

  // Fetch campaigns
  useEffect(() => {
    let mounted = true

    const fetchCampaigns = async () => {
      if (!address) {
        if (mounted) {
          setIsLoading(false)
        }
        return
      }

      try {
        const campaignsRef = collection(db, 'campaigns')
        const q = query(
          campaignsRef,
          where('owner', '==', address.toLowerCase())
        )
        const querySnapshot = await getDocs(q)

        if (mounted) {
          const campaignsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Campaign[]

          setCampaigns(campaignsData)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error fetching campaigns:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCampaigns()

    return () => {
      mounted = false
    }
  }, [address])

  const getStatusColor = (statusText: string) => {
    switch (statusText.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewCampaign = (campaignId: string) => {
    router.push(`/campaigns/${campaignId}`)
  }

  if (!mounted) {
    return null
  }

  if (!address) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-base font-semibold text-blue-600'>
              Connect Wallet
            </p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl'>
              Please connect your wallet to view your campaigns
            </h1>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <p className='text-base font-semibold text-blue-600'>Loading</p>
            <h1 className='mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl'>
              Fetching your campaigns...
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='sm:flex sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight text-gray-900'>
              My Campaigns
            </h1>
            <p className='mt-2 text-sm text-gray-700'>
              Manage and monitor your created campaigns
            </p>
          </div>
          <div className='mt-4 sm:mt-0'>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className='inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
            >
              <PlusIcon className='-ml-0.5 mr-1.5 h-5 w-5' aria-hidden='true' />
              New Campaign
            </button>
          </div>
        </div>

        <div className='mt-8 flow-root'>
          <div className='-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8'>
            <div className='inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8'>
              {processedCampaigns.length === 0 ? (
                <div className='text-center py-12'>
                  <p className='text-sm text-gray-500'>
                    You haven't created any campaigns yet
                  </p>
                  <Link
                    href='/campaigns/create'
                    className='mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    Create Your First Campaign
                  </Link>
                </div>
              ) : (
                <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                  {processedCampaigns.map(campaign => {
                    const token = memoizedGetTokenByAddress(campaign.token)

                    return (
                      <div
                        key={campaign.id}
                        className='bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200'
                      >
                        <div className='px-4 py-5 sm:px-6'>
                          <button
                            onClick={() => handleViewCampaign(campaign.id)}
                            className='w-full text-left'
                          >
                            <h3 className='text-lg font-medium text-gray-900 hover:text-blue-600'>
                              {campaign.title}
                            </h3>
                          </button>
                          <p className='mt-1 text-sm text-gray-500 line-clamp-2'>
                            {campaign.description}
                          </p>
                        </div>
                        <div className='px-4 py-4 sm:px-6'>
                          <div className='space-y-4'>
                            <div>
                              <div className='flex justify-between text-sm font-medium'>
                                <span>Progress</span>
                                <span>{campaign.progress.toFixed(1)}%</span>
                              </div>
                              <div className='mt-2 relative'>
                                <div className='overflow-hidden h-2 text-xs flex rounded bg-gray-100'>
                                  <div
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        campaign.progress
                                      )}%`
                                    }}
                                    className='shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600'
                                  />
                                </div>
                              </div>
                            </div>
                            <div className='grid grid-cols-2 gap-4 text-sm'>
                              <div>
                                <span className='text-gray-500'>Raised</span>
                                <p className='mt-1 font-medium text-gray-900'>
                                  {campaign.formattedRaised} {token?.symbol}
                                </p>
                              </div>
                              <div>
                                <span className='text-gray-500'>Target</span>
                                <p className='mt-1 font-medium text-gray-900'>
                                  {campaign.formattedTarget} {token?.symbol}
                                </p>
                              </div>
                              <div>
                                <span className='text-gray-500'>
                                  Contributors
                                </span>
                                <p className='mt-1 font-medium text-gray-900'>
                                  {campaign.contributors}
                                </p>
                              </div>
                              <div>
                                <span className='text-gray-500'>Days Left</span>
                                <p className='mt-1 font-medium text-gray-900'>
                                  {campaign.daysRemaining} days
                                </p>
                              </div>
                            </div>
                            <div className='flex items-center justify-between'>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${campaign.statusColor}`}
                              >
                                {campaign.statusText}
                                {campaign.statusReasonText &&
                                  ` (${campaign.statusReasonText})`}
                              </span>
                              <button
                                onClick={() => handleViewCampaign(campaign.id)}
                                className='text-sm font-medium text-blue-600 hover:text-blue-500'
                              >
                                View Details →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
    </div>
  )
}
