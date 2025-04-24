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
import { Timestamp } from 'firebase/firestore'
import { useChainId } from 'wagmi'

export default function CampaignsDiscovery() {
  const router = useRouter()
  const chainId = useChainId()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { campaigns, isLoading, error, refresh } = useCampaigns()

  // Handle category from URL parameter
  useEffect(() => {
    if (router.isReady) {
      const { category } = router.query
      if (category && typeof category === 'string') {
        setSelectedCategory(category.toLowerCase() === 'all' ? 'all' : category)
      } else {
        setSelectedCategory('all')
      }
    }
  }, [router.isReady, router.query])

  // Refresh campaigns when chain ID changes
  useEffect(() => {
    if (mounted) {
      refresh()
    }
  }, [chainId, mounted, refresh])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCategoryChange = (category: string) => {
    const newCategory = category.toLowerCase() === 'all' ? 'all' : category
    setSelectedCategory(newCategory)
    // Update URL when category changes
    router.push({
      pathname: router.pathname,
      query: { ...router.query, category: newCategory }
    }, undefined, { shallow: true })
  }

  // Filter campaigns based on search query and category
  const filteredCampaigns = campaigns.filter(campaign => {
    // Skip campaigns without required data
    if (!campaign.createdAt || !campaign.duration) return false

    // Calculate campaign end date
    const createdAtDate = campaign.createdAt.seconds * 1000

    const endDate =  createdAtDate + campaign.duration * 24 * 60 * 60 *1000

    const now = Date.now()
    
    const isActive =  now < endDate

    // Apply search and category filters
    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      selectedCategory === 'all' || campaign.category === selectedCategory

    // Only include active campaigns that match search and category
    return isActive && matchesSearch && matchesCategory
  })

  // Sort campaigns based on selected sort option
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return Number(b.createdAt) - Number(a.createdAt)
      case 'endingSoon':
        return Number(a.createdAt) - Number(b.createdAt)
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
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white py-8'>
      <div className='container mx-auto px-4 py-8'>
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-3xl font-bold'>Discover Campaigns</h1>
          {sortedCampaigns.length > 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className='inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors'
            >
              <RocketLaunchIcon className='w-5 h-5 mr-2' />
              Create Campaign
            </button>
          )}
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
              className='inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50'
            >
              <FunnelIcon className='h-5 w-5 mr-2' />
              Filters
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className='mt-4'>
              <CampaignFilters
                selectedCategory={selectedCategory}
                setSelectedCategory={handleCategoryChange}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />
            </div>
          )}
        </div>

        {/* Campaign Grid */}
        {sortedCampaigns.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {sortedCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => handleCampaignClick(campaign.id)}
              />
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <h3 className='text-xl font-semibold mb-4'>
              No campaigns found
            </h3>
            <p className='text-gray-600 mb-6'>
              Be the first to create a campaign!
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className='inline-flex items-center px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors'
            >
              <RocketLaunchIcon className='w-5 h-5 mr-2' />
              Create Campaign
            </button>
          </div>
        )}

        {/* Create Campaign Modal */}
        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={refresh}
        />
      </div>
    </div>
  )
}
