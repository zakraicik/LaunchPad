import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { ShareIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import Contributors from '../../components/campaigns/Contributors'
import CampaignDetails from '../../components/campaigns/CampaignDetails'
import { formatNumber } from '../../utils/format'
import { doc, getDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits, parseUnits, Contract, BrowserProvider } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { differenceInDays } from 'date-fns'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import toast from 'react-hot-toast'
import CampaignTimer from '../../components/campaigns/CampaignTimer'
import { useClaimFunds } from '../../hooks/campaigns/useClaimFunds'
import { useContribute } from '../../hooks/campaigns/useContribute'
import { useRequestRefund } from '../../hooks/campaigns/useRequestRefund'
import { useUpdatePlatformFeeShare } from '../../hooks/defiManager/useGetATokenAddress'
import { ERC20_ABI } from '../../config/abis/erc20'

interface Campaign {
  id: string
  title: string
  description: string
  goalAmountSmallestUnits: string
  totalRaised?: string
  token: string
  statusText: string
  statusReasonText?: string
  createdAt: string | Date | Timestamp
  duration: string
  contributors?: number
  imageUrl?: string
  category?: string
  campaignAddress?: string
  status: number
  statusReason: number
  creator?: string
  hasClaimed?: boolean
  githubUrl?: string
  totalContributions?: string
}

export default function CampaignDetail () {
  const router = useRouter()
  const { id } = router.query
  const [activeTab, setActiveTab] = useState('balances')
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { getTokenByAddress } = useTokens()
  const [mounted, setMounted] = useState(false)
  const [contributionAmount, setContributionAmount] = useState('')
  const { claimFunds, isClaiming } = useClaimFunds()
  const { contribute, isContributing } = useContribute()
  const { requestRefund, isRequestingRefund } = useRequestRefund()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { getATokenAddress } = useUpdatePlatformFeeShare()
  const [aTokenBalance, setATokenBalance] = useState<string>('0')
  const [isLoadingYield, setIsLoadingYield] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => {
      setCampaign(null)
      setIsLoading(true)
      setActiveTab('balances')
      setMounted(false)
    }
  }, [])

  useEffect(() => {
    if (id) {
      setCampaign(null)
      setIsLoading(true)
      setActiveTab('balances')
    }
  }, [id])

  const fetchCampaign = async (campaignId: string) => {
    if (!campaignId) return

    try {
      setIsLoading(true)
      const campaignRef = doc(db, 'campaigns', campaignId)
      const campaignSnap = await getDoc(campaignRef)

      if (campaignSnap.exists()) {
        // Get unique contributors count
        const contributionEventsRef = collection(db, 'contributionEvents')
        const q = query(
          contributionEventsRef,
          where('campaignId', '==', campaignId)
        )
        const querySnapshot = await getDocs(q)
        
        // Get unique contributors using Set
        const uniqueContributors = new Set<string>()
        querySnapshot.forEach(doc => {
          const data = doc.data()
          if (data.contributor) {
            uniqueContributors.add(data.contributor.toLowerCase())
          }
        })

        const campaignData = {
          id: campaignSnap.id,
          ...campaignSnap.data(),
          contributors: uniqueContributors.size
        } as Campaign
        console.log(
          'Campaign address from Firestore:',
          campaignData.campaignAddress
        )
        setCampaign(campaignData)
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

  // New useEffect to fetch aToken balance
  useEffect(() => {
    const fetchATokenBalance = async () => {
      if (!campaign?.token || !campaign?.campaignAddress || !walletClient) return

      try {
        setIsLoadingYield(true)
        // Get the aToken address for the campaign token
        const aTokenAddress = await getATokenAddress(campaign.token)
        
        // Create provider and contract instances
        const provider = new BrowserProvider(walletClient.transport)
        const aTokenContract = new Contract(aTokenAddress, ERC20_ABI, provider)
        
        // Get the balance of aTokens held by the campaign
        const balance = await aTokenContract.balanceOf(campaign.campaignAddress)
        setATokenBalance(balance.toString())
      } catch (error) {
        console.error('Error fetching aToken balance:', error)
        setATokenBalance('0')
      } finally {
        setIsLoadingYield(false)
      }
    }

    fetchATokenBalance()
  }, [campaign?.token, campaign?.campaignAddress, walletClient])

  // New useEffect to fetch token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!campaign?.token || !campaign?.campaignAddress || !walletClient) return

      try {
        setIsLoadingBalance(true)
        // Create provider and contract instances
        const provider = new BrowserProvider(walletClient.transport)
        const tokenContract = new Contract(campaign.token, ERC20_ABI, provider)
        
        // Get the balance of tokens held by the campaigngit
        const balance = await tokenContract.balanceOf(campaign.campaignAddress)
        setTokenBalance(balance.toString())
      } catch (error) {
        console.error('Error fetching token balance:', error)
        setTokenBalance('0')
      } finally {
        setIsLoadingBalance(false)
      }
    }

    fetchTokenBalance()
  }, [campaign?.token, campaign?.campaignAddress, walletClient])

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
      const rawAmount = formatUnits(amount, token.decimals)
      // Round to remove decimals, then format with commas
      return formatNumber(Math.round(parseFloat(rawAmount)))
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  const calculateProgress = (): number => {
    if (!campaign.totalContributions || !token) return 0
    try {
      const raisedAmount = BigInt(campaign.totalContributions)
      const goalAmount = BigInt(campaign.goalAmountSmallestUnits)
      return Number((raisedAmount * BigInt(100)) / goalAmount)
    } catch (error) {
      console.error('Error calculating progress:', error)
      return 0
    }
  }

  const calculateDaysRemaining = (): number => {
    if (!campaign.createdAt || !campaign.duration) return 0

    // Convert createdAt to a Date object regardless of input type
    let createdAtDate: Date

    if (typeof campaign.createdAt === 'string') {
      createdAtDate = new Date(campaign.createdAt)
    } else if (campaign.createdAt instanceof Date) {
      createdAtDate = campaign.createdAt
    } else {
      // Handle Firestore Timestamp
      createdAtDate = campaign.createdAt.toDate()
    }

    const endDate = new Date(
      createdAtDate.getTime() +
        parseInt(campaign.duration) * 24 * 60 * 60 * 1000
    )
    const daysRemaining = differenceInDays(endDate, new Date())
    return Math.max(0, daysRemaining)
  }

  const progress = calculateProgress()
  const daysLeft = calculateDaysRemaining()
  const formattedRaised = formatAmount(campaign.totalContributions)
  const formattedGoal = formatAmount(campaign.goalAmountSmallestUnits)

  const handleContribute = async () => {
    if (!campaign?.campaignAddress || !contributionAmount || !walletClient || !isConnected || !token) {
      toast.error('Please connect your wallet and enter an amount')
      return
    }

    try {
      const amountInSmallestUnits = parseUnits(contributionAmount, token.decimals)
      await contribute(campaign.campaignAddress, amountInSmallestUnits)
      // Refresh campaign data after successful contribution
      await fetchCampaign(campaign.id)
      // Reset form
      setContributionAmount('')
    } catch (error: any) {
      console.error('Error in handleContribute:', error)
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction was cancelled')
      } else {
        toast.error('Failed to contribute')
      }
    }
  }

  const handleRequestRefund = async () => {
    if (!campaign?.campaignAddress) return

    try {
      await requestRefund(campaign.campaignAddress)
      // Refresh campaign data after successful refund request
      await fetchCampaign(campaign.id)
    } catch (error: any) {
      console.error('Error in handleRequestRefund:', error)
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction was cancelled')
      } else {
        toast.error('Failed to request refund')
      }
    }
  }

  const isCampaignEnded = (): boolean => {
    if (!campaign?.createdAt || !campaign?.duration) return false

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

  const isOwner = address && campaign?.creator && address.toLowerCase() === campaign.creator.toLowerCase()
  const canClaimFunds = isOwner && isCampaignEnded() && !campaign?.hasClaimed

  const handleClaimFunds = async () => {
    if (!campaign?.campaignAddress || !canClaimFunds) return

    try {
      await claimFunds(campaign.campaignAddress)
      // Refresh campaign data after successful claim
      await fetchCampaign(campaign.id)
    } catch (error: any) {
      console.error('Error in handleClaimFunds:', error)
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction was cancelled')
      } else {
        toast.error('Failed to claim funds')
      }
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='container mx-auto px-4'>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Campaigns
        </button>

        {/* Top level grid for the two main containers */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
          {/* Campaign Description Container */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <h2 className='text-xl font-semibold mb-4'>Campaign Description</h2>
            <p className='text-gray-600'>{campaign.description}</p>
          </div>

          {/* Quick Stats Container */}
          <div className='bg-white rounded-lg shadow-sm p-6'>
            <div className='grid grid-cols-3 gap-4'>
              <div className='text-center'>
                <p className='text-base md:text-lg font-medium'>
                  {campaign.contributors || 0}
                </p>
                <p className='text-xs md:text-sm text-gray-500'>Contributors</p>
              </div>
              <div className='text-center'>
                <CampaignTimer
                  startTime={campaign.createdAt instanceof Date ? campaign.createdAt.getTime() / 1000 : typeof campaign.createdAt === 'string' ? new Date(campaign.createdAt).getTime() / 1000 : campaign.createdAt.toDate().getTime() / 1000}
                  endTime={campaign.createdAt instanceof Date ? campaign.createdAt.getTime() / 1000 + Number(campaign.duration) * 24 * 60 * 60 : typeof campaign.createdAt === 'string' ? new Date(campaign.createdAt).getTime() / 1000 + Number(campaign.duration) * 24 * 60 * 60 : campaign.createdAt.toDate().getTime() / 1000 + Number(campaign.duration) * 24 * 60 * 60}
                  duration={Number(campaign.duration)}
                />
                <p className='text-xs md:text-sm text-gray-500'>Time Remaining</p>
              </div>
              <div className='text-center'>
                <p className='text-base md:text-lg font-medium'>
                  {token?.symbol || 'Loading...'}
                </p>
                <p className='text-xs md:text-sm text-gray-500'>Target Coin</p>
              </div>
            </div>

            {/* Progress Section */}
            <div className='mt-6'>
              <div className='w-full bg-gray-200 rounded-full h-2'>
                <div
                  className='bg-blue-600 h-2 rounded-full'
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <div className='flex justify-between items-center mt-4'>
                <div>
                  <p className='text-base md:text-lg font-medium'>
                    {formattedRaised} {token?.symbol}
                  </p>
                  <p className='text-xs md:text-sm text-gray-500'>
                    raised of {formattedGoal} {token?.symbol}
                  </p>
                </div>
                <div className='text-right'>
                  <p className='text-base md:text-lg font-medium'>
                    {formattedGoal} {token?.symbol}
                  </p>
                  <p className='text-xs md:text-sm text-gray-500'>Goal Amount</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Details Card */}
        <div className='bg-white rounded-lg shadow-sm mb-6'>
          <div className='p-6'>
            <CampaignDetails
              category={campaign.category}
              campaignAddress={campaign.campaignAddress}
              owner={campaign.creator}
              githubUrl={campaign.githubUrl}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='bg-white rounded-lg shadow-sm mb-6'>
          <div className='border-b'>
            <nav className='flex overflow-x-auto scrollbar-hide'>
              <button
                onClick={() => setActiveTab('balances')}
                className={`flex-1 px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'balances'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Campaign Balances
              </button>
              <button
                onClick={() => setActiveTab('contributors')}
                className={`flex-1 px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap ${
                  activeTab === 'contributors'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Contributors
              </button>
              {isCampaignEnded() && (
                <button
                  onClick={() => setActiveTab('actions')}
                  className={`flex-1 px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap ${
                    activeTab === 'actions'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Campaign Actions
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className='p-4 md:p-6'>
            {activeTab === 'contributors' && (
              <div>
                <Contributors campaignId={campaign.id} tokenAddress={campaign.token} />
              </div>
            )}

            {activeTab === 'balances' && (
              <div className='space-y-6'>
                <div className='bg-gray-50 rounded-lg p-4'>
                  <h3 className='text-sm font-medium text-gray-900 mb-4'>Campaign Token Balances</h3>
                  <div className='space-y-4'>
                    {!isCampaignEnded() ? (
                      <>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm text-gray-500'>Amount in Contract</span>
                          <span className='text-sm font-medium'>
                            {isLoadingBalance ? (
                              'Loading...'
                            ) : (
                              `${formatAmount(tokenBalance)} ${token?.symbol}`
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm text-gray-500'>Amount in Yield Generation</span>
                          <span className='text-sm font-medium'>
                            {isLoadingYield ? (
                              'Loading...'
                            ) : (
                              `${formatAmount(aTokenBalance)} ${token?.symbol}`
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm text-gray-500'>Amount in Contract</span>
                          <span className='text-sm font-medium'>
                            {isLoadingBalance ? (
                              'Loading...'
                            ) : (
                              `${formatAmount(tokenBalance)} ${token?.symbol}`
                            )}
                          </span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm text-gray-500'>Amount Claimed</span>
                          <span className='text-sm font-medium'>{campaign.hasClaimed ? formatAmount(tokenBalance) : '0'} {token?.symbol}</span>
                        </div>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm text-gray-500'>Amount Available for Refunds</span>
                          <span className='text-sm font-medium'>{campaign.hasClaimed ? '0' : formatAmount(tokenBalance)} {token?.symbol}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'actions' && (
              <div className='space-y-6'>
                {/* Owner Actions */}
                {isOwner && (
                  <div>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h4 className='text-sm font-medium text-gray-900'>Campaign Owner Actions</h4>
                        <p className='text-sm text-gray-500'>
                          {progress >= 100 
                            ? 'Claim raised funds from your successful campaign'
                            : 'Claim campaign funds to enable contributor refunds'}
                        </p>
                      </div>
                      <button
                        onClick={handleClaimFunds}
                        disabled={isClaiming || campaign.hasClaimed}
                        className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        {isClaiming ? 'Claiming...' : campaign.hasClaimed ? 'Funds Claimed' : 'Claim Funds'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contributor Actions - Only show for unsuccessful campaigns */}
                {!isOwner && progress < 100 && (
                  <div>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h4 className='text-sm font-medium text-gray-900'>Contributor Actions</h4>
                        <p className='text-sm text-gray-500'>
                          {campaign.hasClaimed 
                            ? 'Campaign funds have been claimed. You can now request a refund.' 
                            : 'Refunds will be available after the campaign owner claims funds'}
                        </p>
                      </div>
                      <button
                        onClick={handleRequestRefund}
                        disabled={!campaign.hasClaimed || isRequestingRefund}
                        className='group relative bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        title={!campaign.hasClaimed ? 'Waiting for campaign owner to claim funds' : 'Request refund'}
                      >
                        {isRequestingRefund ? 'Requesting...' : 'Request Refund'}
                        {!campaign.hasClaimed && (
                          <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap'>
                            Waiting for owner to claim funds
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Message for successful campaigns */}
                {!isOwner && progress >= 100 && (
                  <div className='text-center py-4'>
                    <p className='text-gray-500'>This campaign has successfully reached its goal. No refund actions are available.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contribution Form */}
        {!isCampaignEnded() && (
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
                  value={contributionAmount}
                  onChange={e => setContributionAmount(e.target.value)}
                  placeholder='Enter amount'
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  disabled={isContributing}
                />
              </div>
              <button
                onClick={handleContribute}
                disabled={
                  !isConnected ||
                  isContributing ||
                  !contributionAmount ||
                  !campaign?.campaignAddress
                }
                className='w-full bg-blue-600 text-white py-3 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isContributing ? 'Contributing...' : 'Contribute'}
              </button>
              {!isConnected && (
                <p className='text-sm text-red-600'>
                  Please connect your wallet to contribute
                </p>
              )}
              {!campaign?.campaignAddress && (
                <p className='text-sm text-red-600'>
                  Campaign contract address not found
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
