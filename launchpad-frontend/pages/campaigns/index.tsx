import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import CampaignCard from '../../components/campaigns/CampaignCard'
import CampaignFilters from '../../components/campaigns/CampaignFilters'

// Dummy data - replace with real data later
const dummyCampaigns = [
  {
    id: 1,
    title: 'Clean Energy Initiative',
    description: 'Supporting renewable energy projects with yield generation',
    image: '/images/placeholder1.jpg',
    category: 'Environment',
    target: 100000,
    raised: 75000,
    daysLeft: 15,
    backers: 156,
    avgYield: 8.5
  },
  {
    id: 2,
    title: 'Education for All',
    description: 'Providing educational resources through sustainable funding',
    image: '/images/placeholder2.jpg',
    category: 'Education',
    target: 50000,
    raised: 35000,
    daysLeft: 25,
    backers: 89,
    avgYield: 7.8
  },
  {
    id: 3,
    title: 'Ocean Cleanup Project',
    description: 'Leveraging yield farming to fund ocean cleanup initiatives',
    image: '/images/placeholder3.jpg',
    category: 'Environment',
    target: 75000,
    raised: 45000,
    daysLeft: 20,
    backers: 112,
    avgYield: 8.2
  },
  {
    id: 4,
    title: 'Medical Research Fund',
    description: 'Accelerating breakthrough medical research through DeFi',
    image: '/images/placeholder4.jpg',
    category: 'Healthcare',
    target: 200000,
    raised: 120000,
    daysLeft: 45,
    backers: 234,
    avgYield: 9.1
  },
  {
    id: 5,
    title: 'AI for Good',
    description: 'Developing ethical AI solutions for social impact',
    image: '/images/placeholder5.jpg',
    category: 'Technology',
    target: 150000,
    raised: 85000,
    daysLeft: 30,
    backers: 167,
    avgYield: 8.7
  },
  {
    id: 6,
    title: 'Sustainable Housing',
    description: 'Building eco-friendly affordable housing communities',
    image: '/images/placeholder6.jpg',
    category: 'Infrastructure',
    target: 300000,
    raised: 195000,
    daysLeft: 60,
    backers: 312,
    avgYield: 7.9
  },
  {
    id: 7,
    title: 'Quantum Computing Research',
    description: 'Advancing quantum computing technology for public benefit',
    image: '/images/placeholder7.jpg',
    category: 'Science & Research',
    target: 250000,
    raised: 125000,
    daysLeft: 40,
    backers: 178,
    avgYield: 8.9
  },
  {
    id: 8,
    title: 'Urban Farming Initiative',
    description: 'Creating sustainable urban farming solutions',
    image: '/images/placeholder8.jpg',
    category: 'Environment',
    target: 80000,
    raised: 52000,
    daysLeft: 35,
    backers: 145,
    avgYield: 8.3
  },
  {
    id: 9,
    title: 'Digital Literacy Program',
    description: 'Bringing technology education to underserved communities',
    image: '/images/placeholder9.jpg',
    category: 'Education',
    target: 60000,
    raised: 42000,
    daysLeft: 28,
    backers: 98,
    avgYield: 7.6
  }
]

export default function CampaignsDiscovery () {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')

  // Handle category from URL parameter
  useEffect(() => {
    if (router.query.category) {
      setSelectedCategory(decodeURIComponent(router.query.category as string))
    }
  }, [router.query.category])

  // Update URL when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    if (category === 'All') {
      const { category, ...rest } = router.query
      router.push(
        {
          pathname: router.pathname,
          query: rest
        },
        undefined,
        { shallow: true }
      )
    } else {
      router.push(
        {
          pathname: router.pathname,
          query: { ...router.query, category }
        },
        undefined,
        { shallow: true }
      )
    }
  }

  // Filter campaigns based on search query and filters
  const filteredCampaigns = dummyCampaigns.filter(campaign => {
    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === 'All' || campaign.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Sort campaigns based on selected sorting option
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return b.raised / b.target - a.raised / a.target
      case 'timeLeft':
        return a.daysLeft - b.daysLeft
      case 'mostFunded':
        return b.raised - a.raised
      default: // 'newest'
        return b.id - a.id
    }
  })

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='container mx-auto px-4'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold mb-2'>Discover Campaigns</h1>
          <p className='text-gray-600'>
            Find and support campaigns that align with your values
          </p>
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
            <CampaignCard key={campaign.id} campaign={campaign} />
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
      </div>
    </div>
  )
}
