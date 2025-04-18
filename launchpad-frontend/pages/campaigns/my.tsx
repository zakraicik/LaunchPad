import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import Link from 'next/link'
import { differenceInDays } from 'date-fns'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import CreateCampaignModal from '../../components/campaigns/CreateCampaignModal'
import {
  useCampaigns,
  Campaign as BaseCampaign
} from '../../hooks/useCampaigns'

interface Campaign extends BaseCampaign {
  statusText: string
  statusReasonText?: string
  duration: string
  goalAmountSmallestUnits: string
  token: string
}

interface CampaignWithCalculations extends Campaign {
  progress: number
  daysRemaining: number
  formattedRaised: string
  formattedTarget: string
  statusColor: string
}

const calculateDaysRemaining = (
  createdAt: string | Date | FirebaseFirestore.Timestamp,
  duration: string
) => {
  if (!createdAt || !duration) return 0

  // Convert createdAt to a Date object regardless of input type
  let createdAtDate: Date

  if (typeof createdAt === 'string') {
    createdAtDate = new Date(createdAt)
  } else if (createdAt instanceof Date) {
    createdAtDate = createdAt
  } else {
    // Handle Firestore Timestamp
    createdAtDate = createdAt.toDate()
  }

  const endDate = new Date(
    createdAtDate.getTime() + parseInt(duration) * 24 * 60 * 60 * 1000
  )

  const daysRemaining = differenceInDays(endDate, new Date())
  return Math.max(0, daysRemaining)
}

export default function MyCampaigns () {
  const router = useRouter()
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const {
    campaigns: realCampaigns,
    isLoading: isLoadingCampaigns,
    refresh: refreshCampaigns
  } = useCampaigns({ filterByOwner: true })
  const { getTokenByAddress } = useTokens()
  const [processedCampaigns, setProcessedCampaigns] = useState<
    CampaignWithCalculations[]
  >([])

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Memoize the token getter
  const memoizedGetTokenByAddress = useCallback(getTokenByAddress, [])

  // Process campaigns
  useEffect(() => {
    if (!realCampaigns.length) return

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

    const processed = realCampaigns.map(campaign => {
      // Use default values for missing properties
      const duration = campaign.duration || '30' // Default duration in days
      const goalAmountSmallestUnits =
        campaign.goalAmountSmallestUnits || campaign.targetAmount
      const token =
        campaign.token || '0x0000000000000000000000000000000000000000' // Default token address
      const statusText =
        campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)

      const daysRemaining = calculateDaysRemaining(campaign.createdAt, duration)

      const processedCampaign = {
        ...campaign,
        duration,
        goalAmountSmallestUnits,
        token,
        statusText,
        progress: calculateProgress(
          campaign.totalRaised,
          goalAmountSmallestUnits,
          token
        ),
        daysRemaining,
        formattedRaised: formatAmount(campaign.totalRaised, token),
        formattedTarget: formatAmount(goalAmountSmallestUnits, token),
        statusColor: getStatusColor(statusText)
      } as CampaignWithCalculations

      return processedCampaign
    })

    setProcessedCampaigns(processed)
  }, [realCampaigns, memoizedGetTokenByAddress])

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

  if (isLoadingCampaigns) {
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

  if (processedCampaigns.length === 0) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <h1 className='text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl'>
              No Campaigns Yet
            </h1>
            <p className='mt-4 text-lg text-gray-500'>
              You haven't created any campaigns yet. Start your first campaign and begin raising funds today!
            </p>
            <div className='mt-8'>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                <PlusIcon className='w-5 h-5 mr-2' />
                Create Your First Campaign
              </button>
            </div>
          </div>
        </div>
        {mounted && (
          <CreateCampaignModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCampaignCreated={() => {
              setIsCreateModalOpen(false)
              refreshCampaigns()
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>My Campaigns</h1>
            <p className='mt-2 text-sm text-gray-500'>
              Manage and track your campaigns
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
                  <div className='flex items-center justify-between mb-4'>
                    <div>
                      <p className='text-sm text-gray-500'>Raised</p>
                      <p className='text-lg font-semibold text-gray-900'>
                        {campaign.formattedRaised} {token?.symbol}
                      </p>
                    </div>
                    <div>
                      <p className='text-sm text-gray-500'>Goal</p>
                      <p className='text-lg font-semibold text-gray-900'>
                        {campaign.formattedTarget} {token?.symbol}
                      </p>
                    </div>
                  </div>
                  <div className='mt-4'>
                    <div className='relative pt-1'>
                      <div className='flex mb-2 items-center justify-between'>
                        <span className='text-sm text-gray-500'>Progress</span>
                        <span className='text-sm font-semibold text-gray-900'>
                          {campaign.progress.toFixed(1)}%
                        </span>
                      </div>
                      <div className='overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200'>
                        <div
                          style={{ width: `${campaign.progress}%` }}
                          className='shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500'
                        />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div>
                          <span
                            className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${campaign.statusColor}`}
                          >
                            {campaign.statusText}
                          </span>
                        </div>
                        <div className='text-right'>
                          <span className='text-xs font-semibold inline-block text-gray-600'>
                            {campaign.daysRemaining} days left
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className='mt-4'>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className='text-sm font-medium text-blue-600 hover:text-blue-500'
                    >
                      View campaign details →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
