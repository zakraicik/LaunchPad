import { useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  RocketLaunchIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import CampaignCard from "../../components/campaigns/CampaignCard";
import CampaignFilters from "../../components/campaigns/CampaignFilters";
import CreateCampaignModal from "../../components/campaigns/CreateCampaignModal";
import { useCampaigns } from "../../hooks/useCampaigns";
import { useRouter } from "next/router";
import { useChainId, useAccount } from "wagmi";
import { useHydration } from "@/pages/_app";
import { useBulkCampaignAuthorization } from "../../hooks/campaigns/useBulkCampaignAuthorization";
import SpeedDialSimple from "../../components/SpeedDialSimple";

export default function CampaignsDiscovery() {
  const { isHydrated } = useHydration();
  const router = useRouter();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { campaigns, isLoading, error, refresh } = useCampaigns();

  // Get campaign addresses for bulk authorization check
  const campaignAddresses = campaigns
    .map((campaign) => campaign.campaignAddress)
    .filter(Boolean) as string[];

  // Use the bulk authorization hook
  const { authorizationMap, isLoading: isLoadingAuthorization } =
    useBulkCampaignAuthorization(campaignAddresses);

  // Handle category from URL parameter
  useEffect(() => {
    if (!isHydrated) return;

    if (router.isReady) {
      const { category } = router.query;
      if (category && typeof category === "string") {
        setSelectedCategory(
          category.toLowerCase() === "all" ? "all" : category
        );
      } else {
        setSelectedCategory("all");
      }
    }
  }, [router.isReady, router.query, isHydrated]);

  // Refresh campaigns when chain ID changes
  useEffect(() => {
    if (isHydrated) {
      refresh();
    }
  }, [chainId, isHydrated, refresh]);

  const handleCategoryChange = (category: string) => {
    if (!isHydrated) return;

    const newCategory = category.toLowerCase() === "all" ? "all" : category;
    setSelectedCategory(newCategory);
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, category: newCategory },
      },
      undefined,
      { shallow: true }
    );
  };

  // Filter campaigns based on search query, category, and authorization status
  const filteredCampaigns = campaigns.filter((campaign) => {
    if (!isHydrated) return false;

    if (!campaign.createdAt || !campaign.duration) return false;

    const campaignAddress = campaign.campaignAddress;

    // If we're still loading authorizations, only show campaigns without addresses
    // This ensures we don't show potentially unauthorized campaigns during loading
    if (isLoadingAuthorization) {
      return !campaignAddress;
    }

    // Check if campaign is authorized
    const isAuthorized =
      !campaignAddress || authorizationMap[campaignAddress] === true;
    if (!isAuthorized) return false;

    const createdAtDate = campaign.createdAt.seconds * 1000;
    const endDate = createdAtDate + campaign.duration * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const isActive = now < endDate;

    const isSuccessful =
      campaign.totalContributions &&
      campaign.goalAmountSmallestUnits &&
      BigInt(campaign.totalContributions) >=
        BigInt(campaign.goalAmountSmallestUnits);

    const matchesSearch =
      campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || campaign.category === selectedCategory;

    return isActive && !isSuccessful && matchesSearch && matchesCategory;
  });

  // Sort campaigns based on selected sort option
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (!isHydrated) return 0;

    switch (sortBy) {
      case "newest":
        return Number(b.createdAt) - Number(a.createdAt);
      case "endingSoon":
        return Number(a.createdAt) - Number(b.createdAt);
      case "mostFunded":
        const bContrib = b.totalContributions
          ? BigInt(b.totalContributions)
          : BigInt(0);
        const aContrib = a.totalContributions
          ? BigInt(a.totalContributions)
          : BigInt(0);
        return bContrib > aContrib ? 1 : bContrib < aContrib ? -1 : 0;
      case "mostBackers":
        return (b.contributors || 0) - (a.contributors || 0);
      default:
        return 0;
    }
  });

  const handleCampaignClick = (campaignId: string) => {
    if (!isHydrated) return;
    router.push(`/campaigns/${campaignId}`);
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col mb-8 relative z-30">
          <h1 className="text-3xl font-bold text-gray-900">
            Discover Campaigns
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Explore and support campaigns
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 relative z-30">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-600 z-10" />
              <input
                type="text"
                id="search"
                placeholder="Search campaigns..."
                className="w-full pl-12 pr-4 py-2.5 bg-white/80 backdrop-blur-md border border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Toggle Button */}
          <div className="flex items-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2.5 bg-white/80 backdrop-blur-md border border-gray-200 rounded-lg hover:border-gray-300 transition-all text-base font-medium shadow-sm hover:shadow-md focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <FunnelIcon className="h-5 w-5 mr-2 inline-block" />
              Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 bg-white/80 backdrop-blur-md rounded-lg p-6 mb-6 border border-gray-200 shadow-sm relative z-20">
            <CampaignFilters
              selectedCategory={selectedCategory}
              setSelectedCategory={handleCategoryChange}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          </div>
        )}

        {/* Campaign Grid */}
        {isLoading || isLoadingAuthorization ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md rounded-lg shadow-[0_0_10px_rgba(191,219,254,0.2)] p-6 "
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => handleCampaignClick(campaign.id)}
                containerClassName="bg-white/50 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)]"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-4">No campaigns found</h3>
            <p className="text-gray-600 mb-6">
              Be the first to create a campaign!
            </p>
          </div>
        )}

        {/* Create Campaign Modal */}
        {isHydrated && (
          <CreateCampaignModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={refresh}
          />
        )}

        {/* SpeedDial */}
        {isHydrated && (
          <SpeedDialSimple
            mainAction={{
              icon: <PlusIcon className="h-6 w-6" />,
              label: "Create Campaign",
              onClick: () => setIsCreateModalOpen(true),
              disabled: !isConnected,
              disabledTooltip: "Connect wallet to create campaign",
            }}
          />
        )}
      </div>
    </div>
  );
}
