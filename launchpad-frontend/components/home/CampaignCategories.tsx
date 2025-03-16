import {
  BeakerIcon,
  BookOpenIcon,
  GlobeAltIcon,
  HeartIcon,
  ComputerDesktopIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

const categories = [
  {
    name: 'Science & Research',
    icon: BeakerIcon,
    description: 'Support groundbreaking scientific research projects',
    color: 'bg-blue-100',
    textColor: 'text-blue-600'
  },
  {
    name: 'Education',
    icon: BookOpenIcon,
    description: 'Fund educational initiatives and learning resources',
    color: 'bg-green-100',
    textColor: 'text-green-600'
  },
  {
    name: 'Environment',
    icon: GlobeAltIcon,
    description: 'Back projects fighting climate change and pollution',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-600'
  },
  {
    name: 'Healthcare',
    icon: HeartIcon,
    description: 'Support medical research and healthcare access',
    color: 'bg-red-100',
    textColor: 'text-red-600'
  },
  {
    name: 'Technology',
    icon: ComputerDesktopIcon,
    description: 'Fund innovative tech solutions and development',
    color: 'bg-purple-100',
    textColor: 'text-purple-600'
  },
  {
    name: 'Infrastructure',
    icon: BuildingOfficeIcon,
    description: 'Support community development projects',
    color: 'bg-orange-100',
    textColor: 'text-orange-600'
  }
]

export default function CampaignCategories () {
  return (
    <section className='py-12 bg-gray-50'>
      <div className='container mx-auto px-4'>
        <h2 className='text-3xl font-bold mb-8 text-center'>
          Campaign Categories
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {categories.map(category => (
            <Link
              key={category.name}
              href={`/campaigns?category=${encodeURIComponent(category.name)}`}
              className='relative group cursor-pointer h-full'
            >
              <div
                className={`p-6 rounded-lg ${category.color} transition-all duration-300 hover:scale-105 h-full flex flex-col`}
              >
                <div className='flex flex-col items-start flex-grow'>
                  <category.icon
                    className={`w-12 h-12 ${category.textColor} mb-4`}
                  />
                  <h3 className='text-xl font-semibold mb-2'>
                    {category.name}
                  </h3>
                  <p className='text-gray-600'>{category.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
