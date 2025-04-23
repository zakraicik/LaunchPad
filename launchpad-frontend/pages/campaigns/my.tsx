import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import Link from 'next/link'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import CreateCampaignModal from '../../components/campaigns/CreateCampaignModal'
import CampaignCard from '../../components/campaigns/CampaignCard'
import {
  useCampaigns,
  Campaign as BaseCampaign
} from '../../hooks/useCampaigns'
import { Timestamp } from 'firebase/firestore'
import { SUPPORTED_NETWORKS } from '../../config/addresses'

interface Campaign extends BaseCampaign {
  statusText: string
  statusReasonText?: string
  duration: number
  goalAmountSmallestUnits: string
  token: string
  hasClaimed: boolean
}

interface CampaignWithCalculations extends Campaign {
  progress: number
  formattedRaised: string
  formattedTarget: string
  statusColor: string
  canClaimFunds?: boolean
}

export default function MyCampaigns () {
  const router = useRouter()
  const { address } = useAccount()
  const chainId = useChainId()
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

  // Refresh campaigns when chain ID changes
  useEffect(() => {
    if (mounted && SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
      refreshCampaigns()
    }
  }, [chainId, mounted, refreshCampaigns])

  // Memoize the token getter
  const memoizedGetTokenByAddress = useCallback(getTokenByAddress, [])

  // Process campaigns
  useEffect(() => {
    if (!realCampaigns.length) {
      setProcessedCampaigns([])
      return
    }

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

    const isCampaignEnded = (createdAt: Timestamp, duration: number): boolean => {
      const startDate = createdAt.toDate()
      const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000)
      return new Date() > endDate
    }

    const processed = realCampaigns.map(campaign => {
      const duration = campaign.duration
      const goalAmountSmallestUnits =
        campaign.goalAmountSmallestUnits || campaign.targetAmount
      const token =
        campaign.token || '0x0000000000000000000000000000000000000000'

      const progress = calculateProgress(
        campaign.totalRaised,
        goalAmountSmallestUnits,
        token
      )
      
      const isEnded = isCampaignEnded(campaign.createdAt, duration)
      const hasReachedGoal = progress >= 100

      // Determine status based on time and goal progress
      let statusText = 'Active'
      let statusColor = 'bg-green-100 text-green-800'
      
      if (isEnded) {
        if (hasReachedGoal) {
          statusText = 'Goal Reached'
          statusColor = 'bg-blue-100 text-blue-800'
        } else {
          statusText = 'Unsuccessful'
          statusColor = 'bg-red-100 text-red-800'
        }
      }

      const canClaimFunds = isEnded && hasReachedGoal && !campaign.hasClaimed

      return {
        ...campaign,
        duration,
        goalAmountSmallestUnits,
        token,
        statusText,
        statusColor,
        progress,
        formattedRaised: formatAmount(campaign.totalRaised, token),
        formattedTarget: formatAmount(goalAmountSmallestUnits, token),
        canClaimFunds
      } as CampaignWithCalculations
    })

    setProcessedCampaigns(processed)
  }, [realCampaigns, memoizedGetTokenByAddress])

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
          {processedCampaigns.map(campaign => (
            <div key={campaign.id} className="relative">
              {campaign.canClaimFunds && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Ready to Claim
                  </span>
                </div>
              )}
              <CampaignCard
                campaign={campaign}
                onClick={() => handleViewCampaign(campaign.id)}
              />
            </div>
          ))}
        </div>
      </div>
      {mounted && (
        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            refreshCampaigns()
          }}
        />
      )}
    </div>
  )
}
