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
import { useChainId, useAccount } from 'wagmi'

export default function CampaignsDiscovery() {
  const router = useRouter()
  const chainId = useChainId()
  const { isConnected } = useAccount()
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
    requestAnimationFrame(() => {
      setMounted(true)
    })
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

    const endDate = createdAtDate + campaign.duration * 24 * 60 * 60 * 1000

    const now = Date.now()
    
    const isActive = now < endDate

    // Check if campaign is successful (raised amount >= goal amount)
    const isSuccessful = campaign.totalContributions && campaign.goalAmountSmallestUnits && 
      BigInt(campaign.totalContributions) >= BigInt(campaign.goalAmountSmallestUnits)

    // Debug logging
    console.log('Campaign filtering:', {
      title: campaign.title,
      totalContributions: campaign.totalContributions,
      goalAmount: campaign.goalAmountSmallestUnits,
      isSuccessful,
      isActive
    })

    // Apply search and category filters
    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      selectedCategory === 'all' || campaign.category === selectedCategory

    // Only include active campaigns that are not successful and match search and category
    return isActive && !isSuccessful && matchesSearch && matchesCategory
  })

  // Sort campaigns based on selected sort option
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return Number(b.createdAt) - Number(a.createdAt)
      case 'endingSoon':
        return Number(a.createdAt) - Number(b.createdAt)
      case 'mostFunded':
        const bContrib = b.totalContributions ? BigInt(b.totalContributions) : BigInt(0)
        const aContrib = a.totalContributions ? BigInt(a.totalContributions) : BigInt(0)
        return bContrib > aContrib ? 1 : bContrib < aContrib ? -1 : 0
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
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-start mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Discover Campaigns</h1>
            <p className='mt-2 text-sm text-gray-500'>
              Explore and support campaigns
            </p>
          </div>
          {sortedCampaigns.length > 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!isConnected}
              className='inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative'
            >
              <RocketLaunchIcon className='w-5 h-5 mr-2' />
              Create Campaign
              {!isConnected && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Connect wallet to create campaign
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search and Filter Bar */}
        <div className='flex flex-col md:flex-row gap-4 mb-6'>
          {/* Search Input */}
          <div className='flex-1 relative'>
            {/* <label htmlFor="search" className='block text-sm font-medium text-gray-700 mb-1'>
              Search
            </label> */}
            <div className='relative'>
              <MagnifyingGlassIcon className='absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
              <input
                type='text'
                id="search"
                placeholder='Search campaigns...'
                className='w-full pl-12 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Toggle Button */}
          <div className='flex items-end'>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-base font-medium'
            >
              <FunnelIcon className='h-5 w-5 mr-2 inline-block' />
              Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className='mt-4 bg-white rounded-lg shadow-sm p-6 mb-6'>
            <CampaignFilters
              selectedCategory={selectedCategory}
              setSelectedCategory={handleCategoryChange}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          </div>
        )}

        {/* Campaign Grid */}
        {isLoading ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='bg-white rounded-lg shadow-sm p-6 animate-pulse'>
                <div className='h-4 bg-gray-200 rounded w-3/4 mb-4'></div>
                <div className='h-20 bg-gray-200 rounded mb-4'></div>
                <div className='space-y-3'>
                  <div className='h-3 bg-gray-200 rounded'></div>
                  <div className='h-3 bg-gray-200 rounded w-5/6'></div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedCampaigns.length > 0 ? (
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
              disabled={!isConnected}
              className='inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative'
            >
              <RocketLaunchIcon className='w-5 h-5 mr-2' />
              Create Campaign
              {!isConnected && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Connect wallet to create campaign
                </span>
              )}
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
