import { Campaign } from '../../hooks/useCampaigns'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { formatTimeLeft } from '../../utils/format'
import { Timestamp } from 'firebase/firestore'

interface CampaignCardProps {
  campaign: Campaign & {
    canClaimFunds?: boolean
    statusText: string
    statusColor: string
  }
  onClick: () => void
}

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  const { getTokenByAddress } = useTokens()
  const token = getTokenByAddress(campaign.token)

  const formatAmount = (amount: string | undefined) => {
    if (!amount || !token) return '0'
    try {
      const formatted = formatUnits(amount, token.decimals)
      return Math.floor(parseFloat(formatted)).toLocaleString()
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  const progress =
    campaign.totalRaised && campaign.targetAmount
      ? (Number(campaign.totalRaised) / Number(campaign.targetAmount)) * 100
      : 0

  const isShortOfGoal = progress < 100

  const calculateTimeRemaining = (): { timeLeft: string, isEnded: boolean } => {
    if (!campaign.createdAt || !campaign.duration) return { timeLeft: '0', isEnded: true }

    try {
      // Handle Firebase Timestamp
      const createdAtDate = typeof campaign.createdAt === 'object' && 'toDate' in campaign.createdAt
        ? (campaign.createdAt as Timestamp).toDate()
        : new Date(campaign.createdAt)

      const endDate = new Date(
        createdAtDate.getTime() +
          campaign.duration * 24 * 60 * 60 * 1000
      )
      
      const now = new Date()
      const isEnded = now > endDate
      
      if (isEnded) {
        return { timeLeft: 'Ended', isEnded: true }
      }

      const secondsRemaining = Math.floor((endDate.getTime() - now.getTime()) / 1000)
      return { timeLeft: formatTimeLeft(secondsRemaining), isEnded: false }
    } catch (error) {
      console.error('Error calculating time remaining:', error)
      return { timeLeft: '0', isEnded: true }
    }
  }

  const { timeLeft, isEnded } = calculateTimeRemaining()

  return (
    <div
      onClick={onClick}
      className='relative bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] [backface-visibility:hidden] [transform-style:preserve-3d]'
    >
      <div className='p-4'>
        <div className='flex justify-between items-start mb-2'>
          <h3 className='text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
            {campaign.title}
          </h3>
          <div className='flex items-center gap-2'>
            <div className='bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-1 rounded-full text-xs font-medium'>
              {campaign.category}
            </div>
            {token && (
              <div className='bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-medium'>
                {token.symbol}
              </div>
            )}
          </div>
        </div>
        
        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>
          {campaign.description}
        </p>

        <div className='space-y-3'>
          <div>
            <div className='flex justify-between text-sm mb-1'>
              <span className='text-gray-600'>Progress</span>
              <span className='font-medium bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent'>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className='w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-full h-2 overflow-hidden'>
              <div
                className='bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Raised</span>
              <p className='font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
                {formatAmount(campaign.totalRaised)} {token?.symbol}
              </p>
            </div>
            <div>
              <span className='text-gray-600'>Target</span>
              <p className='font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
                {formatAmount(campaign.targetAmount)} {token?.symbol}
              </p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Backers</span>
              <p className='font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
                {campaign.contributors || 0}
              </p>
            </div>
            <div>
              <span className='text-gray-600'>Time Left</span>
              {isEnded ? (
                progress >= 100 ? (
                  <div className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                    Goal Reached
                  </div>
                ) : (
                  <div className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                    Goal Not Reached
                  </div>
                )
              ) : (
                <p className='font-medium bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
                  {timeLeft}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
