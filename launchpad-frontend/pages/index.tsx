import CampaignCategories from "../components/home/CampaignCategories";
import HowItWorks from "../components/home/HowItWorks";
import Link from "next/link";
import { RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import CreateCampaignModal from "../components/campaigns/CreateCampaignModal";
import { useAccount } from "wagmi";
import { useHydration } from "./_app";

export default function Home() {
  const { isHydrated } = useHydration();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { isConnected } = useAccount();

  // Show a simple loading state during server-side rendering
  if (!isHydrated) {
    return (
      <main className="min-h-screen">
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl font-bold mb-6">
                Powering Web3 Innovation Through Community Contributions
              </h1>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              Powering Web3 Innovation Through Community Contributions
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Projects launch with minimal fees thanks to integrated yield
              generation, while investors receive full refund protection if
              funding goals aren't met—our blockchain-native platform creates a
              safer, more efficient fundraising environment for the next
              generation of web3 builders
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/campaigns"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Discover Campaigns
              </Link>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!isConnected}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative"
              >
                <RocketLaunchIcon className="w-5 h-5 mr-2" />
                Create Campaign
                {!isConnected && (
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Connect wallet to create campaign
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Categories */}
      <CampaignCategories />

      {/* How It Works */}
      <HowItWorks />

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </main>
  );
}
