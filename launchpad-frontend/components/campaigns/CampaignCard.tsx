import {
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface Campaign {
  id: number
  title: string
  description: string
  image: string
  category: string
  target: number
  raised: number
  daysLeft: number
  backers: number
  avgYield: number
}

interface CampaignCardProps {
  campaign: Campaign
}

export default function CampaignCard ({ campaign }: CampaignCardProps) {
  const progress = (campaign.raised / campaign.target) * 100

  return (
    <div className='bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow'>
      {/* Campaign Image */}
      <div className='aspect-w-16 aspect-h-9 bg-gray-200'>
        {/* Replace with actual Image component when images are available */}
        <div className='w-full h-48 bg-gray-200'></div>
      </div>

      {/* Campaign Info */}
      <div className='p-4'>
        {/* Category Badge */}
        <div className='mb-2'>
          <span className='inline-block px-2 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full'>
            {campaign.category}
          </span>
        </div>

        {/* Title and Description */}
        <h3 className='text-lg font-semibold mb-2 line-clamp-1'>
          {campaign.title}
        </h3>
        <p className='text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]'>
          {campaign.description}
        </p>

        {/* Progress Bar */}
        <div className='mb-4'>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div
              className='bg-blue-600 h-2 rounded-full'
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className='flex justify-between text-sm mt-2'>
            <span className='text-gray-600'>
              ${campaign.raised.toLocaleString()} raised
            </span>
            <span className='text-gray-600'>
              ${campaign.target.toLocaleString()} goal
            </span>
          </div>
        </div>

        {/* Campaign Metrics */}
        <div className='grid grid-cols-3 gap-2 pt-4 border-t'>
          <div className='flex items-center justify-center'>
            <ClockIcon className='h-4 w-4 text-gray-400 mr-1' />
            <span className='text-sm text-gray-600'>
              {campaign.daysLeft}d left
            </span>
          </div>
          <div className='flex items-center justify-center'>
            <UserGroupIcon className='h-4 w-4 text-gray-400 mr-1' />
            <span className='text-sm text-gray-600'>{campaign.backers}</span>
          </div>
          <div className='flex items-center justify-center'>
            <ChartBarIcon className='h-4 w-4 text-gray-400 mr-1' />
            <span className='text-sm text-gray-600'>
              {campaign.avgYield}% APY
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
