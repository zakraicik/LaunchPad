import Image from 'next/image'
import Link from 'next/link'
import { formatNumber } from '../../utils/format'
import CampaignTimer from './CampaignTimer'

interface Campaign {
  id: number
  title: string
  description: string
  image: string
  category: string
  target: number
  raised: number
  startTime: number
  endTime: number
  duration: number
  backers: number
  avgYield: number
}

interface CampaignCardProps {
  campaign: Campaign
}

export default function CampaignCard ({ campaign }: CampaignCardProps) {
  const progress = (campaign.raised / campaign.target) * 100

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <div className='bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200'>
        {/* Campaign Image */}
        <div className='relative h-48 w-full rounded-t-lg overflow-hidden'>
          <Image
            src={campaign.image}
            alt={campaign.title}
            fill
            className='object-cover'
          />
          <div className='absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full'>
            <span className='text-sm font-medium text-gray-900'>
              {campaign.category}
            </span>
          </div>
        </div>

        <div className='p-6'>
          {/* Campaign Title and Description */}
          <h3 className='text-xl font-semibold text-gray-900 mb-2'>
            {campaign.title}
          </h3>
          <p className='text-gray-600 text-sm mb-4 line-clamp-2'>
            {campaign.description}
          </p>

          {/* Campaign Timer */}
          <div className='mb-4'>
            <CampaignTimer
              startTime={campaign.startTime}
              endTime={campaign.endTime}
              duration={campaign.duration}
            />
          </div>

          {/* Progress Bar */}
          <div className='mb-4'>
            <div className='flex justify-between text-sm mb-1'>
              <span className='font-medium text-gray-900'>
                {formatNumber(campaign.raised)} USDC
              </span>
              <span className='text-gray-600'>
                {progress.toFixed(1)}% of {formatNumber(campaign.target)} USDC
              </span>
            </div>
            <div className='h-2 bg-gray-200 rounded-full overflow-hidden'>
              <div
                className='h-full bg-blue-500 rounded-full'
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Campaign Metrics */}
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600'>Backers</span>
              <p className='font-medium text-gray-900'>{campaign.backers}</p>
            </div>
            <div>
              <span className='text-gray-600'>Avg. Yield</span>
              <p className='font-medium text-gray-900'>{campaign.avgYield}%</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
