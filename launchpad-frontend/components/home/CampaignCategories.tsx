import {
  HeartIcon,
  FireIcon,
  ShieldExclamationIcon,
  HandRaisedIcon,
  AcademicCapIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  TrophyIcon,
  SunIcon,
  HomeIcon,
  FlagIcon,
  GlobeAmericasIcon,
  SparklesIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

const categories = [
  {
    name: 'Medical',
    icon: HeartIcon,
    description: 'Support medical treatments and healthcare needs',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Memorial',
    icon: FireIcon,
    description: 'Honor and remember loved ones',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Emergency',
    icon: ShieldExclamationIcon,
    description: 'Help those facing urgent crises and disasters',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Nonprofit',
    icon: HandRaisedIcon,
    description: 'Support charitable organizations and causes',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Education',
    icon: AcademicCapIcon,
    description: 'Fund educational opportunities and resources',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Animal',
    icon: HeartIcon,
    description: 'Help animals in need and support pet care',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Environment',
    icon: SunIcon,
    description: 'Support environmental conservation efforts',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Business',
    icon: BuildingStorefrontIcon,
    description: 'Help small businesses grow and succeed',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Community',
    icon: UsersIcon,
    description: 'Support local community initiatives',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Competition',
    icon: TrophyIcon,
    description: 'Fund competitive events and tournaments',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Creative',
    icon: SparklesIcon,
    description: 'Support artists and creative projects',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Event',
    icon: CalendarIcon,
    description: 'Fund events and gatherings',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Faith',
    icon: HomeIcon,
    description: 'Support religious and spiritual causes',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Family',
    icon: UsersIcon,
    description: 'Help families in need',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Sports',
    icon: TrophyIcon,
    description: 'Support athletes and sports programs',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Travel',
    icon: GlobeAmericasIcon,
    description: 'Fund travel and exploration',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Volunteer',
    icon: HandRaisedIcon,
    description: 'Support volunteer initiatives',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    name: 'Wishes',
    icon: SparklesIcon,
    description: 'Help make wishes come true',
    color: 'bg-blue-50',
    textColor: 'text-blue-600'
  }
]

export default function CampaignCategories () {
  return (
    <section className='py-12 bg-white'>
      <div className='container mx-auto px-4'>
        <h2 className='text-3xl font-bold mb-8 text-center'>
          Campaign Categories
        </h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'>
          {categories.map(category => (
            <Link
              key={category.name}
              href={`/campaigns?category=${encodeURIComponent(category.name)}`}
              className='relative group cursor-pointer h-full'
            >
              <div
                className={`p-4 rounded-lg ${category.color} border border-gray-100 transition-all duration-300 hover:scale-105 hover:shadow-md h-full flex flex-col`}
              >
                <div className='flex flex-col items-center text-center flex-grow'>
                  <category.icon
                    className={`w-8 h-8 ${category.textColor} mb-3`}
                  />
                  <h3 className='text-lg font-semibold mb-1 text-gray-900'>
                    {category.name}
                  </h3>
                  <p className='text-sm text-gray-600'>{category.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
