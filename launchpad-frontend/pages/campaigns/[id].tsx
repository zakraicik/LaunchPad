import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { ShareIcon } from '@heroicons/react/24/outline'
import Contributors from '../../components/campaigns/Contributors'
import { formatNumber } from '../../utils/format'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { differenceInDays } from 'date-fns'

interface Campaign {
  id: string
  title: string
  description: string
  goalAmountSmallestUnits: string
  totalRaised?: string
  token: string
  statusText: string
  statusReasonText?: string
  createdAt: string
  duration: string
  contributors?: number
  imageUrl?: string
  category?: string
}

export default function CampaignDetail () {
  const router = useRouter()
  const { id } = router.query
  const [activeTab, setActiveTab] = useState('details')
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { getTokenByAddress } = useTokens()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => {
      setCampaign(null)
      setIsLoading(true)
      setActiveTab('details')
      setMounted(false)
    }
  }, [])

  useEffect(() => {
    if (id) {
      setCampaign(null)
      setIsLoading(true)
      setActiveTab('details')
    }
  }, [id])

  const fetchCampaign = async (campaignId: string) => {
    if (!campaignId) return

    try {
      setIsLoading(true)
      const campaignRef = doc(db, 'campaigns', campaignId)
      const campaignSnap = await getDoc(campaignRef)

      if (campaignSnap.exists()) {
        setCampaign({
          id: campaignSnap.id,
          ...campaignSnap.data()
        } as Campaign)
      } else {
        setCampaign(null)
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
      setCampaign(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted || !router.isReady) return

    const currentId = router.query.id as string
    if (currentId) {
      fetchCampaign(currentId)
    }
  }, [router.isReady, router.query.id, mounted])

  if (!mounted || !router.isReady) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='container mx-auto px-4'>
          <div className='text-center'>Loading...</div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='container mx-auto px-4'>
          <div className='text-center'>Loading campaign...</div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='container mx-auto px-4'>
          <div className='text-center'>Campaign not found</div>
        </div>
      </div>
    )
  }

  const token = getTokenByAddress(campaign.token)

  const formatAmount = (amount: string | undefined): string => {
    if (!amount || !token) return '0'
    try {
      return formatUnits(amount, token.decimals)
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  const calculateProgress = (): number => {
    if (!campaign.totalRaised || !token) return 0
    try {
      const raisedAmount = parseFloat(
        formatUnits(campaign.totalRaised, token.decimals)
      )
      const goalAmount = parseFloat(
        formatUnits(campaign.goalAmountSmallestUnits, token.decimals)
      )
      return (raisedAmount / goalAmount) * 100
    } catch (error) {
      console.error('Error calculating progress:', error)
      return 0
    }
  }

  const calculateDaysRemaining = (): number => {
    if (!campaign.createdAt || !campaign.duration) return 0
    const endDate = new Date(
      new Date(campaign.createdAt).getTime() +
        parseInt(campaign.duration) * 24 * 60 * 60 * 1000
    )
    const daysRemaining = differenceInDays(endDate, new Date())
    return Math.max(0, daysRemaining)
  }

  const progress = calculateProgress()
  const daysLeft = calculateDaysRemaining()
  const formattedRaised = formatAmount(campaign.totalRaised)
  const formattedGoal = formatAmount(campaign.goalAmountSmallestUnits)

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='container mx-auto px-4'>
        {/* Campaign Header */}
        <div className='bg-white rounded-lg shadow-sm overflow-hidden mb-6'>
          {campaign.imageUrl && (
            <div className='aspect-w-16 aspect-h-9'>
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                className='w-full h-96 object-cover'
              />
            </div>
          )}

          <div className='p-6'>
            <div className='flex justify-between items-start mb-4'>
              <div>
                {campaign.category && (
                  <span className='inline-block px-2 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-2'>
                    {campaign.category}
                  </span>
                )}
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
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <div className='flex justify-between items-center mt-4'>
                <div>
                  <p className='text-2xl font-bold'>
                    {formattedRaised} {token?.symbol}
                  </p>
                  <p className='text-sm text-gray-600'>
                    raised of {formattedGoal} {token?.symbol}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-2xl font-bold'>{daysLeft}</p>
                  <p className='text-sm text-gray-600'>days left</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-3 gap-4 py-4 border-t border-b'>
              <div>
                <p className='text-2xl font-bold'>
                  {campaign.contributors || 0}
                </p>
                <p className='text-sm text-gray-600'>contributors</p>
              </div>
              <div>
                <p className='text-2xl font-bold'>
                  {campaign.statusText}
                  {campaign.statusReasonText &&
                    ` (${campaign.statusReasonText})`}
                </p>
                <p className='text-sm text-gray-600'>Status</p>
              </div>
              <div>
                <p className='text-2xl font-bold'>
                  {token?.symbol || 'Loading...'}
                </p>
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
                onClick={() => setActiveTab('contributors')}
                className={`px-6 py-4 text-sm font-medium ${
                  activeTab === 'contributors'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Contributors
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className='p-6'>
            {activeTab === 'details' && (
              <div className='prose max-w-none'>
                <p>{campaign.description}</p>
              </div>
            )}

            {activeTab === 'contributors' && campaign.contributors ? (
              <div>
                <p className='text-gray-600'>
                  This campaign has {campaign.contributors} contributor
                  {campaign.contributors !== 1 ? 's' : ''}.
                </p>
              </div>
            ) : (
              <div>
                <p className='text-gray-600'>No contributors yet</p>
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
                Amount ({token?.symbol})
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
