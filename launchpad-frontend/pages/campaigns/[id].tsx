import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import {
  ShareIcon,
  ArrowLeftIcon,
  RocketLaunchIcon,
  BanknotesIcon,
  FlagIcon,
  ShieldCheckIcon,
  KeyIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Contributors from "../../components/campaigns/Contributors";
import CampaignDetails from "../../components/campaigns/CampaignDetails";
import { formatNumber } from "../../utils/format";
import {
  doc,
  getDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import { formatUnits, parseUnits, Contract, BrowserProvider } from "ethers";
import { useTokens } from "../../hooks/useTokens";
import { differenceInDays } from "date-fns";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import toast from "react-hot-toast";
import CampaignTimer from "../../components/campaigns/CampaignTimer";
import {
  useClaimFunds,
  useContribute,
  useRequestRefund,
  useHasClaimedFunds,
} from "@/hooks/campaigns";
import { useIsContributor } from "@/hooks/campaigns/useIsContributor";
import { useGetATokenAddress } from "@/hooks/defiManager/useGetATokenAddress";
import { ERC20_ABI } from "../../config/abis/erc20";
import useRefundStatuses from "@/hooks/campaigns/useRefundStatuses";
import Link from "next/link";
import { useHydration } from "@/pages/_app";
import { useIsAdmin } from "../../utils/admin";
import { useDeauthorizeCampaign } from "../../hooks/campaigns/useDeauthorizeCampaign";
import { CONTRACT_ADDRESSES, SUPPORTED_NETWORKS } from "../../config/addresses";
import { useChainId } from "wagmi";
import { useCampaignAuthorization } from "../../hooks/campaigns/useCampaignAuthorization";
import { useSetAdminOverride } from "@/hooks/campaigns/useSetAdminOverride";
import { useAdminOverrideStatus } from "@/hooks/campaigns/useAdminOverrideStatus";
import SpeedDial from "../../components/SpeedDial";

interface Campaign {
  id: string;
  title: string;
  description: string;
  goalAmountSmallestUnits: string;
  totalRaised?: string;
  token: string;
  statusText: string;
  statusReasonText?: string;
  createdAt: string | Date | Timestamp;
  duration: string;
  contributors?: number;
  imageUrl?: string;
  category?: string;
  campaignAddress?: string;
  status: number;
  statusReason: number;
  creator?: string;
  hasClaimed?: boolean;
  githubUrl?: string;
  totalContributions?: string;
}

export default function CampaignDetail() {
  const { isHydrated } = useHydration();
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState("contributors");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getTokenByAddress } = useTokens();
  const [contributionAmount, setContributionAmount] = useState("");
  const { claimFunds, isClaiming } = useClaimFunds();
  const { contribute, isContributing } = useContribute();
  const { requestRefund, isRequestingRefund } = useRequestRefund();
  const { hasClaimed, isChecking } = useHasClaimedFunds(
    campaign?.campaignAddress
  );
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { getATokenAddress, isUpdating } = useGetATokenAddress();
  const [aTokenBalance, setATokenBalance] = useState<string>("0");
  const [isLoadingYield, setIsLoadingYield] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address);
  const { deauthorizeCampaign, isDeauthorizing } = useDeauthorizeCampaign();
  const chainId = useChainId();
  const { isAuthorized, isLoading: isLoadingAuthorization } =
    useCampaignAuthorization(campaign?.campaignAddress);
  const [adminOverrideEnabled, setAdminOverrideEnabled] = useState(false);
  const { setAdminOverride, isSettingOverride } = useSetAdminOverride();
  const { isOverrideEnabled, isLoading: isLoadingOverride } =
    useAdminOverrideStatus(campaign?.campaignAddress);
  const [isOpen, setIsOpen] = useState(false);

  // Update the adminOverrideEnabled state when isOverrideEnabled changes
  useEffect(() => {
    if (!isLoadingOverride) {
      setAdminOverrideEnabled(isOverrideEnabled);
    }
  }, [isOverrideEnabled, isLoadingOverride]);

  const isSuccessful = (): boolean => {
    if (!campaign?.totalContributions || !campaign?.goalAmountSmallestUnits)
      return false;
    try {
      const totalContributions = BigInt(campaign.totalContributions);
      const goalAmount = BigInt(campaign.goalAmountSmallestUnits);
      return totalContributions >= goalAmount;
    } catch (error) {
      console.error("Error checking if campaign is successful:", error);
      return false;
    }
  };

  const isCampaignEnded = (): boolean => {
    if (!campaign?.createdAt || !campaign?.duration) return false;

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
        parseInt(campaign.duration) * 24 * 60 * 60 * 1000
    );
    return new Date() > endDate;
  };

  const canContribute = (): boolean => {
    return !isCampaignEnded() && !isSuccessful();
  };

  const campaigns = campaign
    ? [
        {
          campaignId: campaign.id,
          campaignAddress: campaign.campaignAddress,
          isRefundEligible: isCampaignEnded() && !isSuccessful(),
        },
      ]
    : [];
  const contributorStatuses = useIsContributor(campaigns, address);
  const refundStatuses = useRefundStatuses(campaigns, address);
  const isContributor = campaign ? contributorStatuses[campaign.id] : false;
  const hasBeenRefunded = campaign ? refundStatuses[campaign.id] : false;

  useEffect(() => {
    if (id) {
      setCampaign(null);
      setIsLoading(true);
      setActiveTab("contributors");
    }
  }, [id]);

  const fetchCampaign = async (campaignId: string) => {
    if (!isHydrated) return;

    try {
      setIsLoading(true);
      const campaignRef = doc(db, "campaigns", campaignId);
      const campaignSnap = await getDoc(campaignRef);

      if (campaignSnap.exists()) {
        const contributionEventsRef = collection(db, "contributionEvents");
        const q = query(
          contributionEventsRef,
          where("campaignId", "==", campaignId)
        );
        const querySnapshot = await getDocs(q);

        const uniqueContributors = new Set<string>();
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.contributor) {
            uniqueContributors.add(data.contributor.toLowerCase());
          }
        });

        const campaignData = {
          id: campaignSnap.id,
          ...campaignSnap.data(),
          contributors: uniqueContributors.size,
        } as Campaign;
        setCampaign(campaignData);
      } else {
        setCampaign(null);
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
      setCampaign(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isHydrated || !router.isReady) return;

    const currentId = router.query.id as string;
    if (currentId) {
      fetchCampaign(currentId);
    }
  }, [router.isReady, router.query.id, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    const fetchATokenBalance = async () => {
      if (!campaign?.token || !campaign?.campaignAddress || !walletClient)
        return;

      try {
        setIsLoadingYield(true);
        const aTokenAddress = await getATokenAddress(campaign.token);
        const provider = new BrowserProvider(walletClient.transport);
        const aTokenContract = new Contract(aTokenAddress, ERC20_ABI, provider);
        const balance = await aTokenContract.balanceOf(
          campaign.campaignAddress
        );
        setATokenBalance(balance.toString());
      } catch (error) {
        console.error("Error fetching aToken balance:", error);
        setATokenBalance("0");
      } finally {
        setIsLoadingYield(false);
      }
    };

    fetchATokenBalance();
  }, [campaign?.token, campaign?.campaignAddress, walletClient, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    const fetchTokenBalance = async () => {
      if (!campaign?.token || !campaign?.campaignAddress || !walletClient)
        return;

      try {
        setIsLoadingBalance(true);
        const provider = new BrowserProvider(walletClient.transport);
        const tokenContract = new Contract(campaign.token, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(campaign.campaignAddress);
        setTokenBalance(balance.toString());
      } catch (error) {
        console.error("Error fetching token balance:", error);
        setTokenBalance("0");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchTokenBalance();
  }, [campaign?.token, campaign?.campaignAddress, walletClient, isHydrated]);

  if (!isHydrated || !router.isReady) {
    return (
      <div className="min-h-screen py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading campaign...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Campaign not found</div>
        </div>
      </div>
    );
  }

  const token = getTokenByAddress(campaign.token);

  const formatAmount = (amount: string | undefined): string => {
    if (!amount || !token) return "0.0";
    try {
      const rawAmount = formatUnits(amount, token.decimals);
      // Format with 1 decimal place
      return formatNumber(Number(parseFloat(rawAmount).toFixed(1)));
    } catch (error) {
      console.error("Error formatting amount:", error);
      return "0.0";
    }
  };

  const calculateProgress = (): number => {
    if (!campaign.totalContributions || !token) return 0;
    try {
      const raisedAmount = BigInt(campaign.totalContributions);
      const goalAmount = BigInt(campaign.goalAmountSmallestUnits);
      return Number((raisedAmount * BigInt(100)) / goalAmount);
    } catch (error) {
      console.error("Error calculating progress:", error);
      return 0;
    }
  };

  const calculateDaysRemaining = (): number => {
    if (!campaign.createdAt || !campaign.duration) return 0;

    // Convert createdAt to a Date object regardless of input type
    let createdAtDate: Date;

    if (typeof campaign.createdAt === "string") {
      createdAtDate = new Date(campaign.createdAt);
    } else if (campaign.createdAt instanceof Date) {
      createdAtDate = campaign.createdAt;
    } else {
      // Handle Firestore Timestamp
      createdAtDate = campaign.createdAt.toDate();
    }

    const endDate = new Date(
      createdAtDate.getTime() +
        parseInt(campaign.duration) * 24 * 60 * 60 * 1000
    );
    const daysRemaining = differenceInDays(endDate, new Date());
    return Math.max(0, daysRemaining);
  };

  const progress = calculateProgress();
  const daysLeft = calculateDaysRemaining();
  const formattedRaised = formatAmount(campaign.totalContributions);
  const formattedGoal = formatAmount(campaign.goalAmountSmallestUnits);

  const handleContribute = async () => {
    if (
      !campaign?.campaignAddress ||
      !contributionAmount ||
      !walletClient ||
      !isConnected ||
      !token
    ) {
      toast.error("Please connect your wallet and enter an amount");
      return;
    }

    try {
      const amountInSmallestUnits = parseUnits(
        contributionAmount,
        token.decimals
      );
      await contribute(campaign.campaignAddress, amountInSmallestUnits);
      // Refresh campaign data after successful contribution
      await fetchCampaign(campaign.id);
      // Reset form
      setContributionAmount("");
    } catch (error: any) {
      console.error("Error in handleContribute:", error);
      if (error.code === "ACTION_REJECTED") {
        toast.error("Transaction was cancelled");
      } else {
        toast.error("Failed to contribute");
      }
    }
  };

  const handleRequestRefund = async () => {
    if (!campaign?.campaignAddress) return;

    try {
      await requestRefund(campaign.campaignAddress);
      // Refresh campaign data after successful refund request
      await fetchCampaign(campaign.id);
    } catch (error: any) {
      console.error("Error in handleRequestRefund:", error);
      if (error.code === "ACTION_REJECTED") {
        toast.error("Transaction was cancelled");
      } else {
        toast.error("Failed to request refund");
      }
    }
  };

  const isOwner =
    address &&
    campaign?.creator &&
    address.toLowerCase() === campaign.creator.toLowerCase();
  const canClaimFunds =
    isOwner && (isCampaignEnded() || isSuccessful()) && !hasClaimed;

  const handleClaimFunds = async () => {
    if (!campaign?.campaignAddress || !canClaimFunds) return;

    try {
      await claimFunds(campaign.campaignAddress);
      // No need to manually set hasClaimed - React Query will handle the cache invalidation
      await fetchCampaign(campaign.id);
    } catch (error: any) {
      console.error("Error in handleClaimFunds:", error);
      if (error.code === "ACTION_REJECTED") {
        toast.error("Transaction was cancelled");
      } else {
        toast.error("Failed to claim funds");
      }
    }
  };

  const handleDeauthorizeCampaign = async () => {
    if (!campaign?.campaignAddress) {
      toast.error("Campaign address not found");
      return;
    }

    try {
      // Get the event collector address from the config
      const eventCollectorAddress = CONTRACT_ADDRESSES[
        chainId as (typeof SUPPORTED_NETWORKS)[number]
      ].eventCollector as `0x${string}`;

      await deauthorizeCampaign(
        eventCollectorAddress,
        campaign.campaignAddress
      );

      // Refresh campaign data after deauthorization
      await fetchCampaign(campaign.id);
    } catch (error: any) {
      console.error("Error deauthorizing campaign:", error);
      if (error.code !== "ACTION_REJECTED") {
        toast.error("Failed to deauthorize campaign");
      }
    }
  };

  // Function to handle admin button click based on campaign state
  const handleAdminAction = () => {
    if (isAuthorized) {
      handleDeauthorizeCampaign();
    } else {
      // Removed the reauthorization functionality
      toast.error("Campaigns cannot be reauthorized once deauthorized");
    }
  };

  // Function to determine if the user can interact with the campaign
  const canInteractWithCampaign = (): boolean => {
    return isAuthorized === true && !adminOverrideEnabled;
  };

  // Updated functions to include authorization check
  const canContributeToday = (): boolean => {
    return canContribute() && canInteractWithCampaign();
  };

  const canClaimFundsToday = (): boolean => {
    return canClaimFunds === true && canInteractWithCampaign();
  };

  const canRequestRefundToday = (): boolean => {
    return (
      isContributor &&
      isCampaignEnded() &&
      !isSuccessful() &&
      !hasBeenRefunded &&
      canInteractWithCampaign()
    );
  };

  const isRefundWaitingForOwnerClaim = (): boolean => {
    return canRequestRefundToday() && !hasClaimed;
  };

  const isRefundEnabled = (): boolean => {
    return canRequestRefundToday() && hasClaimed;
  };

  // Add share handler
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaign?.title || "Campaign",
          text: campaign?.description || "",
          url: window.location.href,
        });
      } else {
        // Fallback to copying to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Campaigns
        </button>

        {/* Top Row: Campaign Info and Details in separate containers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
          {/* Campaign Title and Description Container */}
          <div className="col-span-1 md:col-span-2 bg-white/10 backdrop-blur-md rounded-lg p-4 md:p-6 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    {campaign.title}
                  </h1>
                  {isOwner && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Owner
                    </span>
                  )}
                  {!isAuthorized && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Terminated
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 break-words">
                  {campaign.description}
                </p>
              </div>
            </div>
          </div>

          {/* Campaign Details Container */}
          <div className="col-span-1 bg-white/10 backdrop-blur-md rounded-lg p-4 md:p-6 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
              Campaign Details
            </h3>
            <CampaignDetails
              category={campaign.category}
              campaignAddress={campaign.campaignAddress}
              owner={campaign.creator}
              githubUrl={campaign.githubUrl}
            />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 md:p-6 mb-6 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-base font-medium">
                {campaign.contributors || 0}
              </p>
              <p className="text-xs text-gray-500">Contributors</p>
            </div>
            <div className="text-center">
              {isSuccessful() ? (
                <>
                  <p className="text-base font-medium text-green-600">
                    Successful
                  </p>
                  <p className="text-xs text-gray-500">Campaign Status</p>
                </>
              ) : isCampaignEnded() ? (
                <>
                  <p className="text-base font-medium text-red-600">
                    Unsuccessful
                  </p>
                  <p className="text-xs text-gray-500">Campaign Status</p>
                </>
              ) : (
                <>
                  <CampaignTimer
                    startTime={
                      campaign.createdAt instanceof Date
                        ? campaign.createdAt.getTime() / 1000
                        : typeof campaign.createdAt === "string"
                        ? new Date(campaign.createdAt).getTime() / 1000
                        : campaign.createdAt.toDate().getTime() / 1000
                    }
                    endTime={
                      campaign.createdAt instanceof Date
                        ? campaign.createdAt.getTime() / 1000 +
                          Number(campaign.duration) * 24 * 60 * 60
                        : typeof campaign.createdAt === "string"
                        ? new Date(campaign.createdAt).getTime() / 1000 +
                          Number(campaign.duration) * 24 * 60 * 60
                        : campaign.createdAt.toDate().getTime() / 1000 +
                          Number(campaign.duration) * 24 * 60 * 60
                    }
                    duration={Number(campaign.duration)}
                  />
                  <p className="text-xs text-gray-500">Time Remaining</p>
                </>
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-medium">
                {token?.symbol || "Loading..."}
              </p>
              <p className="text-xs text-gray-500">Target Coin</p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-4">
              <div>
                <p className="text-base font-medium">
                  {formattedRaised} {token?.symbol}
                </p>
                <p className="text-xs text-gray-500">
                  raised of {formattedGoal} {token?.symbol}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-medium">
                  {formattedGoal} {token?.symbol}
                </p>
                <p className="text-xs text-gray-500">Goal Amount</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg mb-6 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab("contributors")}
                className={`flex-1 px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap ${
                  activeTab === "contributors"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Contributors
              </button>
              <button
                onClick={() => setActiveTab("balances")}
                className={`flex-1 px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium whitespace-nowrap ${
                  activeTab === "balances"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Campaign Balances
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {activeTab === "contributors" && (
              <div>
                <Contributors
                  campaignId={campaign.id}
                  tokenAddress={campaign.token}
                />
              </div>
            )}

            {activeTab === "balances" && (
              <div className="space-y-6">
                <div className="bg-white/0 backdrop-blur-md rounded-lg p-4 ">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">
                    Campaign Token Balances
                  </h3>
                  <div className="bg-white/0 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Amount in Contract
                      </span>
                      <span className="text-sm font-medium">
                        {isLoadingBalance
                          ? "Loading..."
                          : `${formatAmount(tokenBalance)} ${token?.symbol}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Amount in Yield Generating Protocol
                      </span>
                      <span className="text-sm font-medium">
                        {isLoadingYield
                          ? "Loading..."
                          : `${formatAmount(aTokenBalance)} ${token?.symbol}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contribution Modal */}
        {isOpen && (
          <div
            id="contribution-section"
            className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="bg-white backdrop-blur-xl rounded-lg p-6 max-w-md w-full mx-4 shadow-[0_0_10px_rgba(191,219,254,0.2)] border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <RocketLaunchIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900">
                  Make a Contribution
                </h2>
                <p className="text-sm text-gray-600">
                  Support this campaign and help make it a reality
                </p>
              </div>

              <div className="mb-6">
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Amount
                </label>
                <div className="relative mt-1">
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all"
                    disabled={isContributing || !isAuthorized}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <span className="text-gray-900 font-medium">
                      {token?.symbol}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleContribute}
                disabled={
                  !isConnected ||
                  isContributing ||
                  !contributionAmount ||
                  !campaign?.campaignAddress ||
                  !isAuthorized
                }
                className="w-full bg-blue-600 text-white py-2.5 px-6 rounded-full text-base font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isContributing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Contributing...</span>
                  </>
                ) : (
                  <>
                    <RocketLaunchIcon className="h-4 w-4" />
                    <span>Contribute</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SpeedDial */}
        {campaign && (
          <div className="fixed bottom-8 right-8 z-[100]">
            <SpeedDial
              canContribute={canContributeToday()}
              canRequestRefund={canRequestRefundToday()}
              canClaimFunds={canClaimFundsToday()}
              onContribute={() => {
                setIsOpen(true);
              }}
              onRequestRefund={handleRequestRefund}
              onClaimFunds={handleClaimFunds}
              onShare={handleShare}
              isContributing={isContributing}
              isRequestingRefund={isRequestingRefund}
              isClaiming={isClaiming}
              isRefundWaitingForOwnerClaim={isRefundWaitingForOwnerClaim()}
              // Admin props
              isAdmin={isHydrated && isAdmin && !isLoadingAdmin}
              isAuthorized={isAuthorized}
              isDeauthorizing={isDeauthorizing}
              adminOverrideEnabled={adminOverrideEnabled}
              isSettingOverride={isSettingOverride}
              onDeauthorize={handleAdminAction}
              onToggleOverride={async () => {
                if (!campaign?.campaignAddress || isSettingOverride) return;
                try {
                  await setAdminOverride(
                    campaign.campaignAddress,
                    !adminOverrideEnabled
                  );
                  setAdminOverrideEnabled(!adminOverrideEnabled);
                } catch (error) {
                  // Error handling is done in the hook
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
