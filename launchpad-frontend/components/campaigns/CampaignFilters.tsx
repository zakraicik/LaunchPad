interface CampaignFiltersProps {
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  sortBy: string
  setSortBy: (sort: string) => void
}

const categories = [
  'All',
  'Science & Research',
  'Education',
  'Environment',
  'Healthcare',
  'Technology',
  'Infrastructure'
]

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'progress', label: 'Most Progress' },
  { value: 'timeLeft', label: 'Time Remaining' },
  { value: 'mostFunded', label: 'Most Funded' }
]

export default function CampaignFilters ({
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy
}: CampaignFiltersProps) {
  return (
    <div className='mt-4 pt-4 border-t border-gray-200'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Category Filter */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Category
          </label>
          <div className='flex flex-wrap gap-2'>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className='w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
