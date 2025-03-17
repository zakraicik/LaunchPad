interface CampaignFiltersProps {
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  sortBy: string
  setSortBy: (sortBy: string) => void
}

const categories = [
  { id: 'all', name: 'All Categories' },
  { id: 'Environment', name: 'Environment' },
  { id: 'Education', name: 'Education' },
  { id: 'Healthcare', name: 'Healthcare' },
  { id: 'Technology', name: 'Technology' },
  { id: 'Social', name: 'Social Impact' }
]

const sortOptions = [
  { id: 'newest', name: 'Newest First' },
  { id: 'endingSoon', name: 'Ending Soon' },
  { id: 'mostFunded', name: 'Most Funded' },
  { id: 'mostBackers', name: 'Most Backers' }
]

export default function CampaignFilters ({
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy
}: CampaignFiltersProps) {
  return (
    <div className='mt-4 flex flex-col sm:flex-row gap-4'>
      {/* Category Filter */}
      <div className='flex-1'>
        <label
          htmlFor='category'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Category
        </label>
        <select
          id='category'
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className='w-full rounded-lg border border-gray-300 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        >
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sort Filter */}
      <div className='flex-1'>
        <label
          htmlFor='sort'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Sort By
        </label>
        <select
          id='sort'
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className='w-full rounded-lg border border-gray-300 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        >
          {sortOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
