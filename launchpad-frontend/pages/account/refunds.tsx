import { useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "ethers";
import { useTokens } from "../../hooks/useTokens";
import { formatNumber } from "../../utils/format";
import { formatDistanceToNow } from "date-fns";
import { ArrowPathIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRefunds } from "../../hooks/campaigns/useRefunds";
import { useHydration } from "../../pages/_app";

export default function RefundsPage() {
  const { isHydrated } = useHydration();
  const { address, isConnected } = useAccount();
  const { getTokenByAddress } = useTokens();

  const { data: refundsData, isLoading } = useRefunds(
    isHydrated && address ? address : undefined
  );

  const refundEvents = refundsData?.refundEvents || [];
  const campaigns = refundsData?.campaignRefunds || {};

  const stats = useMemo(() => {
    const uniqueCampaigns = new Set(
      refundEvents.map((event) => event.campaignId)
    );

    const refundsByToken = refundEvents.reduce((acc, event) => {
      const campaign = campaigns[event.campaignId];
      const tokenAddress = campaign?.token || "";
      if (!acc[tokenAddress]) {
        acc[tokenAddress] = {
          amounts: [],
          count: 0,
        };
      }
      acc[tokenAddress].amounts.push(event.amount);
      acc[tokenAddress].count++;
      return acc;
    }, {} as Record<string, { amounts: string[]; count: number }>);

    const tokenStats = Object.entries(refundsByToken)
      .map(([tokenAddress, data]) => {
        const token = getTokenByAddress(tokenAddress);
        if (!token) return null;

        const total = data.amounts.reduce((sum, amount) => {
          try {
            const formatted = parseFloat(formatUnits(amount, token.decimals));
            return sum + formatted;
          } catch (error) {
            console.error("Error calculating total:", error);
            return sum;
          }
        }, 0);

        return {
          symbol: token.symbol,
          total: total.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          count: data.count,
        };
      })
      .filter(
        (stats): stats is { symbol: string; total: string; count: number } =>
          stats !== null
      );

    return {
      totalRefunds: refundEvents.length,
      uniqueCampaigns: uniqueCampaigns.size,
      tokenStats,
    };
  }, [refundEvents, campaigns, getTokenByAddress]);

  const formatAmount = (amount: string, tokenAddress: string) => {
    const token = getTokenByAddress(tokenAddress);
    if (!token) return "0";
    try {
      const formattedAmount = formatUnits(amount, token.decimals);
      return Math.floor(parseFloat(formattedAmount)).toLocaleString();
    } catch (error) {
      console.error("Error formatting amount:", error);
      return "0";
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            Please connect your wallet to view your refunds
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading your refunds...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
      <div className="container mx-auto px-4">
        {refundEvents.length > 0 ? (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-6">
                <ArrowPathIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Your Refunds
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Track your campaign refunds
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Total Refunds
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {stats.totalRefunds}
                  </dd>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Unique Campaigns
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">
                    {stats.uniqueCampaigns}
                  </dd>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Refunds by Token
                  </dt>
                  <dd className="mt-1">
                    {stats.tokenStats.map(({ symbol, total, count }) => (
                      <div key={symbol} className="mb-2 last:mb-0">
                        <div className="text-2xl font-semibold text-gray-900">
                          {total} {symbol}
                        </div>
                        <div className="text-sm text-gray-500">
                          {count} refund{count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </dd>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flow-root">
                <ul role="list" className="-mb-8">
                  {refundEvents.map((event) => {
                    const campaign = campaigns[event.campaignId];
                    const token = getTokenByAddress(campaign?.token || "");

                    return (
                      <li key={event.transactionHash} className="relative pb-8">
                        <div className="relative flex items-start space-x-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 flex-1">
                                  <Link
                                    href={`/campaigns/${event.campaignId}`}
                                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1"
                                  >
                                    {campaign?.title || "Unknown Campaign"}
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                      />
                                    </svg>
                                  </Link>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    Refund Received
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500">
                                  Block #{event.blockNumber}
                                </div>
                              </div>
                              <p className="mt-0.5 text-sm text-gray-500">
                                Refunded{" "}
                                {formatAmount(
                                  event.amount,
                                  campaign?.token || ""
                                )}{" "}
                                {token?.symbol || "tokens"} •{" "}
                                {formatDistanceToNow(event.blockTimestamp, {
                                  addSuffix: true,
                                })}
                              </p>
                              <div className="mt-2 text-sm text-gray-500">
                                <a
                                  href={`https://basescan.org/tx/${event.transactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  View transaction →
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <RocketLaunchIcon className="mx-auto h-12 w-12 text-blue-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No Refunds
            </h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              You have no refunds to display. Continue supporting innovative
              projects and help bring new ideas to life!
            </p>
            <div className="mt-6">
              <Link
                href="/discover"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <RocketLaunchIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Discover Campaigns
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
