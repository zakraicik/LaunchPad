import { useEffect, useState, useCallback, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { formatUnits } from "ethers";
import { useTokens } from "../../hooks/useTokens";
import Link from "next/link";
import { PlusIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import CreateCampaignModal from "../../components/campaigns/CreateCampaignModal";
import CampaignCard from "../../components/campaigns/CampaignCard";
import {
  useCampaigns,
  Campaign as BaseCampaign,
} from "../../hooks/useCampaigns";
import { Timestamp } from "firebase/firestore";
import { SUPPORTED_NETWORKS } from "../../config/addresses";
import { useHydration } from "@/pages/_app";
import { useBulkCampaignAuthorization } from "../../hooks/campaigns/useBulkCampaignAuthorization";
import SpeedDialSimple from "../../components/SpeedDialSimple";

interface Campaign extends BaseCampaign {
  statusText: string;
  statusReasonText?: string;
  duration: number;
  goalAmountSmallestUnits: string;
  token: string;
  hasClaimed: boolean;
  totalRaised?: string;
}

interface CampaignWithCalculations extends Campaign {
  progress: number;
  formattedRaised: string;
  formattedTarget: string;
  statusColor: string;
  canClaimFunds?: boolean;
}

export default function MyCampaigns() {
  const { isHydrated } = useHydration();
  const router = useRouter();
  const { address } = useAccount();
  const chainId = useChainId();
  const {
    campaigns: realCampaigns,
    isLoading: isLoadingCampaigns,
    refresh: refreshCampaigns,
  } = useCampaigns({ filterByOwner: true });
  const { getTokenByAddress } = useTokens();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Get campaign authorization statuses
  const { authorizationMap } = useBulkCampaignAuthorization(
    realCampaigns.map((campaign) => campaign.campaignAddress || "")
  );

  // Refresh campaigns when chain ID changes
  useEffect(() => {
    if (
      isHydrated &&
      SUPPORTED_NETWORKS.includes(
        chainId as (typeof SUPPORTED_NETWORKS)[number]
      )
    ) {
      refreshCampaigns();
    }
  }, [chainId, isHydrated, refreshCampaigns]);

  // Memoize the token getter
  const memoizedGetTokenByAddress = useCallback(getTokenByAddress, [
    getTokenByAddress,
  ]);

  // Memoize helper functions
  const formatAmount = useCallback(
    (amount: string | undefined, tokenAddress: string): string => {
      if (!isHydrated) return "0";
      if (!amount) return "0";
      try {
        const token = memoizedGetTokenByAddress(tokenAddress);
        if (!token) return "0";
        const formatted = formatUnits(amount, token.decimals);
        return Math.floor(parseFloat(formatted)).toLocaleString();
      } catch (error) {
        console.error("Error formatting amount:", error);
        return "0";
      }
    },
    [memoizedGetTokenByAddress, isHydrated]
  );

  const calculateProgress = useCallback(
    (raised: string | undefined, goal: string, tokenAddress: string) => {
      if (!isHydrated) return 0;
      if (!raised) return 0;
      try {
        const token = memoizedGetTokenByAddress(tokenAddress);
        if (!token) return 0;
        const raisedAmount = parseFloat(formatUnits(raised, token.decimals));
        const goalAmount = parseFloat(formatUnits(goal, token.decimals));
        return (raisedAmount / goalAmount) * 100;
      } catch (error) {
        console.error("Error calculating progress:", error);
        return 0;
      }
    },
    [memoizedGetTokenByAddress, isHydrated]
  );

  // Add isSuccessful function
  const isSuccessful = useCallback(
    (campaign: CampaignWithCalculations): boolean => {
      if (!campaign.totalContributions || !campaign.goalAmountSmallestUnits)
        return false;
      try {
        const totalContributions = BigInt(campaign.totalContributions);
        const goalAmount = BigInt(campaign.goalAmountSmallestUnits);
        return totalContributions >= goalAmount;
      } catch (error) {
        console.error("Error checking if campaign is successful:", error);
        return false;
      }
    },
    []
  );

  // Add isCampaignEnded function
  const isCampaignEnded = useCallback(
    (campaign: CampaignWithCalculations): boolean => {
      if (!campaign.createdAt || !campaign.duration) return false;

      let createdAtDate: Date;
      if (typeof campaign.createdAt === "string") {
        createdAtDate = new Date(campaign.createdAt);
      } else if (campaign.createdAt instanceof Date) {
        createdAtDate = campaign.createdAt;
      } else {
        createdAtDate = campaign.createdAt.toDate();
      }

      const endDate = new Date(
        createdAtDate.getTime() +
          parseInt(campaign.duration.toString()) * 24 * 60 * 60 * 1000
      );
      return new Date() > endDate;
    },
    []
  );

  // Add getCampaignStatus function
  const getCampaignStatus = useCallback(
    (campaign: CampaignWithCalculations): string => {
      // Check if campaign is terminated first
      if (
        campaign.campaignAddress &&
        !authorizationMap[campaign.campaignAddress]
      ) {
        return "Terminated";
      }

      if (isSuccessful(campaign)) {
        return "Successful";
      }

      if (isCampaignEnded(campaign)) {
        return "Unsuccessful";
      }

      return "Active";
    },
    [isSuccessful, isCampaignEnded, authorizationMap]
  );

  // Process campaigns directly
  const processedCampaigns = useMemo(() => {
    if (!isHydrated || !realCampaigns.length) return [];

    return realCampaigns.map((campaign) => {
      const duration = campaign.duration;
      const goalAmountSmallestUnits =
        campaign.goalAmountSmallestUnits || campaign.targetAmount;
      const token =
        campaign.token || "0x0000000000000000000000000000000000000000";

      const progress = calculateProgress(
        campaign.totalContributions,
        goalAmountSmallestUnits,
        token
      );

      const isEnded = isCampaignEnded({
        ...campaign,
        duration,
        goalAmountSmallestUnits,
        token,
        progress,
        formattedRaised: formatAmount(campaign.totalContributions, token),
        formattedTarget: formatAmount(goalAmountSmallestUnits, token),
      } as CampaignWithCalculations);

      const hasReachedGoal = progress >= 100;

      // Determine status based on time and goal progress
      let statusText = "Active";
      let statusColor = "bg-green-100 text-green-800";

      if (isEnded) {
        if (hasReachedGoal) {
          statusText = "Goal Reached";
          statusColor = "bg-blue-100 text-blue-800";
        } else {
          statusText = "Unsuccessful";
          statusColor = "bg-red-100 text-red-800";
        }
      }

      const canClaimFunds = isEnded && hasReachedGoal && !campaign.hasClaimed;

      return {
        ...campaign,
        duration,
        goalAmountSmallestUnits,
        token,
        statusText,
        statusColor,
        progress,
        formattedRaised: formatAmount(campaign.totalContributions, token),
        formattedTarget: formatAmount(goalAmountSmallestUnits, token),
        canClaimFunds,
      } as CampaignWithCalculations;
    });
  }, [
    realCampaigns,
    formatAmount,
    calculateProgress,
    isCampaignEnded,
    isHydrated,
  ]);

  const handleViewCampaign = (campaignId: string) => {
    if (!isHydrated) return;
    router.push(`/campaigns/${campaignId}`);
  };

  // Update getAvailableStatuses function
  const getAvailableStatuses = useCallback(() => {
    const statuses = new Set(["All"]);
    processedCampaigns.forEach((campaign) => {
      const status = getCampaignStatus(campaign);
      statuses.add(status);
    });
    return Array.from(statuses);
  }, [processedCampaigns, getCampaignStatus]);

  // Update filterCampaigns function
  const filterCampaigns = useCallback(
    (campaigns: CampaignWithCalculations[]) => {
      if (statusFilter === "All") return campaigns;
      return campaigns.filter(
        (campaign) => getCampaignStatus(campaign) === statusFilter
      );
    },
    [statusFilter, getCampaignStatus]
  );

  if (!isHydrated) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-base font-semibold text-blue-600">
              Connect Wallet
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Please connect your wallet to view your campaigns
            </h1>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingCampaigns) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-base font-semibold text-blue-600">Loading</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Fetching your campaigns...
            </h1>
          </div>
        </div>
      </div>
    );
  }

  if (processedCampaigns.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              No Campaigns Yet
            </h1>
            <p className="mt-4 text-lg text-gray-500">
              You haven't created any campaigns yet. Start your first campaign
              and begin raising funds today!
            </p>
          </div>
        </div>

        {/* SpeedDial */}
        {isHydrated && (
          <SpeedDialSimple
            mainAction={{
              icon: <PlusIcon className="h-6 w-6" />,
              label: "Create Campaign",
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        )}

        {/* Create Campaign Modal */}
        {isHydrated && (
          <CreateCampaignModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              setIsCreateModalOpen(false);
              refreshCampaigns();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <RocketLaunchIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Campaigns</h1>
              <p className="mt-2 text-sm text-gray-500">
                Manage and track your campaigns
              </p>
            </div>
          </div>
        </div>

        {processedCampaigns.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {getAvailableStatuses().map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100/80 backdrop-blur-sm text-gray-600 hover:bg-gray-200/80"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filterCampaigns(processedCampaigns).map((campaign) => (
            <div key={campaign.id} className="relative">
              {campaign.canClaimFunds && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100/80 backdrop-blur-sm text-green-800">
                    Ready to Claim
                  </span>
                </div>
              )}
              <CampaignCard
                campaign={campaign}
                onClick={() => handleViewCampaign(campaign.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* SpeedDial */}
      {isHydrated && (
        <div className="fixed bottom-8 right-8 z-[100]">
          <SpeedDialSimple
            mainAction={{
              icon: <PlusIcon className="h-8 w-8" />,
              label: "Create Campaign",
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        </div>
      )}

      {/* Create Campaign Modal */}
      {isHydrated && (
        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            refreshCampaigns();
          }}
        />
      )}
    </div>
  );
}
