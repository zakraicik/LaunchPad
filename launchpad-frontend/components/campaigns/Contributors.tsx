import { UserCircleIcon } from '@heroicons/react/24/outline'

interface Contributor {
  address: string
  amount: number
  timestamp: string
  isTopContributor: boolean
}

interface ContributorsProps {
  contributors: Contributor[]
  totalContributors: number
}

export default function Contributors ({
  contributors,
  totalContributors
}: ContributorsProps) {
  return (
    <div>
      <div className='flex justify-between items-center mb-6'>
        <h3 className='text-lg font-semibold'>
          Contributors ({totalContributors})
        </h3>
        <div className='text-sm text-gray-600'>
          Showing top {contributors.length} contributors
        </div>
      </div>

      <div className='space-y-4'>
        {contributors.map((contributor, index) => (
          <div
            key={contributor.address}
            className={`flex items-center justify-between p-4 rounded-lg ${
              contributor.isTopContributor ? 'bg-blue-50' : 'bg-gray-50'
            }`}
          >
            <div className='flex items-center space-x-3'>
              <div className='relative'>
                <UserCircleIcon className='h-10 w-10 text-gray-400' />
                {contributor.isTopContributor && (
                  <div className='absolute -top-1 -right-1'>
                    <span className='flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] text-white'>
                      {index + 1}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <div className='font-medium'>
                  {contributor.address.slice(0, 6)}...
                  {contributor.address.slice(-4)}
                </div>
                <div className='text-sm text-gray-500'>
                  {contributor.timestamp}
                </div>
              </div>
            </div>
            <div className='text-right'>
              <div className='font-medium'>
                ${contributor.amount.toLocaleString()}
              </div>
              {contributor.isTopContributor && (
                <div className='text-sm text-blue-600'>Top Contributor</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
