import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { ShareIcon } from '@heroicons/react/24/outline'
import Contributors from '../../components/campaigns/Contributors'
import CampaignDetails from '../../components/campaigns/CampaignDetails'
import { formatNumber } from '../../utils/format'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits, parseUnits, Contract, BrowserProvider } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { differenceInDays } from 'date-fns'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import toast from 'react-hot-toast'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import CampaignTimer from '../../components/campaigns/CampaignTimer'
import { useClaimFunds } from '../../hooks/campaigns/useClaimFunds'

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
  const [isContributing, setIsContributing] = useState(false)
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { claimFunds, isClaiming } = useClaimFunds()

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
        const campaignData = {
          id: campaignSnap.id,
          ...campaignSnap.data()
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
  const formattedRaised = formatAmount(campaign.totalRaised)
  const formattedGoal = formatAmount(campaign.goalAmountSmallestUnits)

  const handleContribute = async () => {
    if (
      !campaign?.campaignAddress ||
      !contributionAmount ||
      !walletClient ||
      !isConnected ||
      !token
    ) {
      toast.error('Please connect your wallet and enter an amount')
      return
    }

    setIsContributing(true)
    const toastId = toast.loading('Contributing to campaign...')
    let signer

    try {
      // Create provider and signer using the same pattern as useCampaignFactory
      const provider = new BrowserProvider(walletClient.transport)
      signer = await provider.getSigner()

      // Create token contract instance
      const tokenContract = new Contract(
        campaign.token,
        [
          'function approve(address spender, uint256 amount) public returns (bool)',
          'function allowance(address owner, address spender) public view returns (uint256)',
          'function balanceOf(address owner) public view returns (uint256)'
        ],
        signer
      )

      // Convert amount to smallest units
      const amountInSmallestUnits = parseUnits(
        contributionAmount,
        token.decimals
      )

      // Check user's token balance
      const userBalance = await tokenContract.balanceOf(address)
      if (userBalance < amountInSmallestUnits) {
        const formattedBalance = formatUnits(userBalance, token.decimals)
        toast.error(
          `Insufficient balance. You have ${formattedBalance} ${token.symbol}`,
          { id: toastId }
        )
        return
      }

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        address,
        campaign.campaignAddress
      )

      // If allowance is less than amount, request approval
      if (currentAllowance < amountInSmallestUnits) {
        toast.loading('Approving token transfer...', { id: toastId })
        try {
          const approveTx = await tokenContract.approve(
            campaign.campaignAddress,
            amountInSmallestUnits
          )
          await approveTx.wait()
        } catch (approveError: any) {
          // Handle user rejection of approval
          if (
            approveError?.code === 'ACTION_REJECTED' ||
            approveError?.message?.includes('user rejected')
          ) {
            toast.error('Token approval was cancelled', { id: toastId })
            return
          }
          throw approveError // Re-throw other errors
        }
      }

      // Create campaign contract instance
      const campaignContract = new Contract(
        campaign.campaignAddress,
        CampaignABI.abi,
        signer
      )

      // Send contribution transaction
      const tx = await campaignContract.contribute(amountInSmallestUnits)
      toast.loading('Waiting for confirmation...', { id: toastId })

      // Wait for transaction
      await tx.wait()

      toast.success('Contribution successful!', { id: toastId })

      // Refresh campaign data
      await fetchCampaign(campaign.id)

      // Reset form
      setContributionAmount('')
    } catch (error: any) {
      console.error('Error contributing:', error)

      // Reset approval on failure
      if (signer) {
        try {
          const tokenContract = new Contract(
            campaign.token,
            [
              'function approve(address spender, uint256 amount) public returns (bool)'
            ],
            signer
          )
          await tokenContract.approve(campaign.campaignAddress, 0)
        } catch (approvalError) {
          console.error('Error resetting approval:', approvalError)
        }
      }

      // Show user-friendly error messages
      let errorMessage = 'Failed to contribute'
      if (error) {
        if (
          error.code === 'ACTION_REJECTED' ||
          error.message?.includes('user rejected')
        ) {
          errorMessage = 'Transaction was cancelled'
        } else if (error.message?.includes('transfer amount exceeds balance')) {
          errorMessage = 'Insufficient token balance'
        } else if (
          error.message?.includes('transfer amount exceeds allowance')
        ) {
          errorMessage = 'Token approval failed'
        } else {
          errorMessage = error.message || 'Failed to contribute'
        }
      }

      toast.error(errorMessage, { id: toastId })
    } finally {
      setIsContributing(false)
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
    } catch (error) {
      console.error('Error in handleClaimFunds:', error)
    }
  }

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

          <div className='p-4 md:p-6'>
            <div className='flex justify-between items-start mb-4'>
              <div className='w-full'>
                <div className='flex flex-col md:flex-row md:items-center gap-2 md:gap-4'>
                  <h1 className='text-xl md:text-2xl font-bold'>{campaign.title}</h1>
                  {(() => {
                    // Handle Firebase Timestamp or Date object
                    const createdAtDate = typeof campaign.createdAt === 'object' && 'toDate' in campaign.createdAt
                      ? campaign.createdAt.toDate()
                      : new Date(campaign.createdAt)
                    
                    const isEnded = new Date() > new Date(createdAtDate.getTime() + parseInt(campaign.duration) * 24 * 60 * 60 * 1000)
                    const progress = campaign.totalRaised && campaign.goalAmountSmallestUnits
                      ? (Number(campaign.totalRaised) / Number(campaign.goalAmountSmallestUnits)) * 100
                      : 0
                    const hasReachedGoal = progress >= 100

                    if (!isEnded) {
                      return (
                        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit'>
                          Active
                        </span>
                      )
                    }
                    
                    if (hasReachedGoal) {
                      return (
                        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit'>
                          Goal Reached
                        </span>
                      )
                    }
                    
                    return (
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit'>
                        Goal Not Reached
                      </span>
                    )
                  })()}
                </div>
              </div>
              <button
                className='p-2 hover:bg-gray-100 rounded-full flex-shrink-0'
                aria-label='Share'
              >
                <ShareIcon className='h-5 w-5 text-gray-600' />
              </button>
            </div>

            {/* Progress Section */}
            <div className='mb-6'>
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

            {/* Quick Stats */}
            <div className='grid grid-cols-3 gap-2 md:gap-4 py-4 border-t border-b'>
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
          </div>
        </div>

        {/* Campaign Details Card */}
        <div className='bg-white rounded-lg shadow-sm mb-6'>
          <div className='p-6'>
            <CampaignDetails
              description={campaign.description}
              category={campaign.category}
              campaignAddress={campaign.campaignAddress}
              owner={campaign.creator}
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
                <p className='text-gray-600'>
                  {campaign.contributors
                    ? `This campaign has ${campaign.contributors} contributor${
                        campaign.contributors !== 1 ? 's' : ''
                      }.`
                    : 'No contributors yet'}
                </p>
              </div>
            )}

            {activeTab === 'balances' && (
              <div className='space-y-6'>
                <div className='bg-gray-50 rounded-lg p-4'>
                  <h3 className='text-sm font-medium text-gray-900 mb-4'>Campaign Token Balances</h3>
                  <div className='space-y-4'>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>Total Raised</span>
                      <span className='text-sm font-medium'>{formattedRaised} {token?.symbol}</span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>Available for Claim</span>
                      <span className='text-sm font-medium'>Coming soon</span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-sm text-gray-500'>Claimed Amount</span>
                      <span className='text-sm font-medium'>Coming soon</span>
                    </div>
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
                        onClick={() => {/* TODO: Implement refund logic */}}
                        disabled={!campaign.hasClaimed}
                        className='group relative bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        title={!campaign.hasClaimed ? 'Waiting for campaign owner to claim funds' : 'Request refund'}
                      >
                        Request Refund
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
