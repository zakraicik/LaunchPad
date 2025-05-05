interface CampaignFiltersProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
}

export default function CampaignFilters({
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
}: CampaignFiltersProps) {
  const categories = [
    "all",
    "DeFi",
    "Infrastructure",
    "DAOs",
    "NFTs",
    "Gaming",
    "Identity",
    "RWA",
    "Public Goods",
    "Climate",
    "Enterprise",
  ];

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "endingSoon", label: "Ending Soon" },
    { value: "mostFunded", label: "Most Funded" },
    { value: "mostBackers", label: "Most Backers" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedCategory === category
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              {category === "all" ? "All Categories" : category}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sort By
        </label>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                sortBy === option.value
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
