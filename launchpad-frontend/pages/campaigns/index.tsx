import { useState, useEffect } from 'react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'
import CampaignCard from '../../components/campaigns/CampaignCard'
import CampaignFilters from '../../components/campaigns/CampaignFilters'
import CreateCampaignModal from '../../components/campaigns/CreateCampaignModal'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useRouter } from 'next/router'

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

// Helper function to generate timestamps
const getTimestamps = (durationInDays: number, isStarted: boolean = true) => {
  const now = Math.floor(Date.now() / 1000)
  const day = 24 * 60 * 60 // seconds in a day

  if (isStarted) {
    const startTime = now - 2 * day // Started 2 days ago
    return {
      startTime,
      endTime: startTime + durationInDays * day,
      duration: durationInDays
    }
  } else {
    const startTime = now + day // Starts in 1 day
    return {
      startTime,
      endTime: startTime + durationInDays * day,
      duration: durationInDays
    }
  }
}

// Helper function to calculate days left
const getDaysLeft = (endTime: number): number => {
  const now = Math.floor(Date.now() / 1000)
  const secondsLeft = endTime - now
  return Math.max(0, Math.floor(secondsLeft / (24 * 60 * 60)))
}

// Dummy data - replace with real data later
export const dummyCampaigns: Campaign[] = [
  {
    id: 1,
    title: 'Clean Energy Initiative',
    description: 'Supporting renewable energy projects with yield generation',
    image: '/placeholder.svg',
    category: 'Environment',
    target: 100000,
    raised: 75000,
    ...getTimestamps(30), // 30-day campaign
    backers: 156,
    avgYield: 8.5
  },
  {
    id: 2,
    title: 'Education for All',
    description: 'Providing educational resources through sustainable funding',
    image: '/placeholder.svg',
    category: 'Education',
    target: 50000,
    raised: 35000,
    ...getTimestamps(45, false), // 45-day campaign, not started yet
    backers: 89,
    avgYield: 7.8
  },
  {
    id: 3,
    title: 'Ocean Cleanup Project',
    description: 'Leveraging yield farming to fund ocean cleanup initiatives',
    image: '/placeholder.svg',
    category: 'Environment',
    target: 75000,
    raised: 45000,
    ...getTimestamps(60), // 60-day campaign
    backers: 112,
    avgYield: 8.2
  },
  {
    id: 4,
    title: 'Medical Research Fund',
    description: 'Accelerating breakthrough medical research through DeFi',
    image: '/placeholder.svg',
    category: 'Healthcare',
    target: 200000,
    raised: 120000,
    ...getTimestamps(90), // 90-day campaign
    backers: 234,
    avgYield: 9.1
  },
  {
    id: 5,
    title: 'AI for Good',
    description: 'Developing ethical AI solutions for social impact',
    image: '/placeholder.svg',
    category: 'Technology',
    target: 150000,
    raised: 85000,
    ...getTimestamps(45), // 45-day campaign
    backers: 167,
    avgYield: 8.7
  },
  {
    id: 6,
    title: 'Sustainable Housing',
    description: 'Building eco-friendly affordable housing communities',
    image: '/placeholder.svg',
    category: 'Infrastructure',
    target: 300000,
    raised: 195000,
    ...getTimestamps(120), // 120-day campaign
    backers: 312,
    avgYield: 7.9
  },
  {
    id: 7,
    title: 'Quantum Computing Research',
    description: 'Advancing quantum computing technology for public benefit',
    image: '/placeholder.svg',
    category: 'Science & Research',
    target: 250000,
    raised: 125000,
    ...getTimestamps(75), // 75-day campaign
    backers: 178,
    avgYield: 8.9
  },
  {
    id: 8,
    title: 'Urban Farming Initiative',
    description: 'Creating sustainable urban farming solutions',
    image: '/placeholder.svg',
    category: 'Environment',
    target: 80000,
    raised: 52000,
    ...getTimestamps(30), // 30-day campaign
    backers: 145,
    avgYield: 8.3
  },
  {
    id: 9,
    title: 'Digital Literacy Program',
    description: 'Bringing technology education to underserved communities',
    image: '/placeholder.svg',
    category: 'Education',
    target: 60000,
    raised: 42000,
    ...getTimestamps(45, false), // 45-day campaign, not started yet
    backers: 98,
    avgYield: 7.6
  }
]

export default function CampaignsDiscovery () {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { campaigns: realCampaigns, isLoading: isLoadingCampaigns } =
    useCampaigns()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
  }

  // Filter campaigns based on search query and category
  const filteredCampaigns = realCampaigns.filter(campaign => {
    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      selectedCategory === 'all' || campaign.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  // Sort campaigns based on selected sort option
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'endingSoon':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'mostFunded':
        return Number(b.totalRaised) - Number(a.totalRaised)
      case 'mostBackers':
        return (b.contributors || 0) - (a.contributors || 0)
      default:
        return 0
    }
  })

  const handleCampaignClick = (campaignId: string) => {
    router.push(`/campaigns/${campaignId}`)
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='container mx-auto px-4 py-8'>
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-3xl font-bold'>Discover Campaigns</h1>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className='inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors'
          >
            <RocketLaunchIcon className='w-5 h-5 mr-2' />
            Create Campaign
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className='bg-white rounded-lg shadow-sm p-4 mb-6'>
          <div className='flex flex-col md:flex-row gap-4'>
            {/* Search Input */}
            <div className='flex-1 relative'>
              <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
              <input
                type='text'
                placeholder='Search campaigns...'
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50'
            >
              <FunnelIcon className='h-5 w-5 mr-2' />
              Filters
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <CampaignFilters
              selectedCategory={selectedCategory}
              setSelectedCategory={handleCategoryChange}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          )}
        </div>

        {/* Campaign Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {sortedCampaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => handleCampaignClick(campaign.id)}
            />
          ))}
        </div>

        {/* No Results Message */}
        {sortedCampaigns.length === 0 && (
          <div className='text-center py-12'>
            <p className='text-gray-600'>
              No campaigns found matching your criteria.
            </p>
          </div>
        )}

        {/* Create Campaign Modal */}
        {mounted && (
          <CreateCampaignModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCampaignCreated={() => {
              // The useCampaigns hook will automatically refresh
              setIsCreateModalOpen(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
