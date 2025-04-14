import { Campaign } from '../../hooks/useCampaigns'
import { formatEther } from 'ethers'
import { formatDistanceToNow } from 'date-fns'

interface CampaignCardProps {
  campaign: Campaign
  onClick: () => void
}

export default function CampaignCard ({ campaign, onClick }: CampaignCardProps) {
  const progress =
    campaign.totalRaised && campaign.targetAmount
      ? (Number(campaign.totalRaised) / Number(campaign.targetAmount)) * 100
      : 0

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Recently'
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch (error) {
      return 'Recently'
    }
  }

  return (
    <div
      onClick={onClick}
      className='bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200'
    >
      <div className='relative h-48'>
        <img
          src={campaign.imageUrl || '/placeholder-campaign.jpg'}
          alt={campaign.title}
          className='w-full h-full object-cover'
        />
        <div className='absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium'>
          {campaign.category}
        </div>
      </div>

      <div className='p-4'>
        <h3 className='text-lg font-semibold text-gray-900 mb-2'>
          {campaign.title}
        </h3>
        <p className='text-gray-600 text-sm mb-4 line-clamp-2'>
          {campaign.description}
        </p>

        <div className='space-y-3'>
          <div>
            <div className='flex justify-between text-sm mb-1'>
              <span className='text-gray-600'>Progress</span>
              <span className='font-medium'>{progress.toFixed(1)}%</span>
            </div>
            <div className='w-full bg-gray-200 rounded-full h-2'>
              <div
                className='bg-blue-500 h-2 rounded-full'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Raised</span>
              <p className='font-medium'>
                {campaign.totalRaised ? formatEther(campaign.totalRaised) : '0'}{' '}
                ETH
              </p>
            </div>
            <div>
              <span className='text-gray-600'>Target</span>
              <p className='font-medium'>
                {campaign.targetAmount
                  ? formatEther(campaign.targetAmount)
                  : '0'}{' '}
                ETH
              </p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Backers</span>
              <p className='font-medium'>{campaign.contributors || 0}</p>
            </div>
            <div>
              <span className='text-gray-600'>APY</span>
              <p className='font-medium'>{campaign.currentAPY || 0}%</p>
            </div>
          </div>

          <div className='text-sm text-gray-500'>
            Created {formatDate(campaign.createdAt)}
          </div>
        </div>
      </div>
    </div>
  )
}
