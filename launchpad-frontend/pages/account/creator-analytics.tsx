import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { ChartBarIcon } from "@heroicons/react/24/outline";

export default function CreatorAnalytics() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            Please connect your wallet to view your creator analytics
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 mb-6">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Creator Analytics
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track performance metrics for your campaigns
            </p>
          </div>
        </div>

        {/* Content will go here - using frosted glass effect for cards */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <p className="text-gray-600">Analytics dashboard coming soon...</p>
        </div>
      </div>
    </div>
  );
}
