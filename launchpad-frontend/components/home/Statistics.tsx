import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ChartBarIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'

const stats = [
  {
    name: 'Total Funds Raised',
    value: '$2.5M',
    icon: CurrencyDollarIcon,
    description: 'Total amount raised across all campaigns'
  },
  {
    name: 'Active Campaigns',
    value: '45',
    icon: RocketLaunchIcon,
    description: 'Number of currently active campaigns'
  },
  {
    name: 'Total Backers',
    value: '12K+',
    icon: UserGroupIcon,
    description: 'Unique contributors to campaigns'
  },
  {
    name: 'Average Yield',
    value: '8.5%',
    icon: ChartBarIcon,
    description: 'Average annual yield generated'
  }
]

export default function Statistics () {
  return (
    <section className='py-12 bg-white'>
      <div className='container mx-auto px-4'>
        <h2 className='text-3xl font-bold mb-12 text-center'>
          Platform Statistics
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
          {stats.map(stat => (
            <div key={stat.name} className='relative'>
              <div className='p-6 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-300'>
                <div className='flex items-center justify-center mb-4'>
                  <div className='p-3 rounded-full bg-blue-100'>
                    <stat.icon className='w-6 h-6 text-blue-600' />
                  </div>
                </div>
                <h3 className='text-2xl font-bold text-center mb-2'>
                  {stat.value}
                </h3>
                <p className='text-lg font-medium text-center mb-1'>
                  {stat.name}
                </p>
                <p className='text-sm text-gray-600 text-center'>
                  {stat.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
