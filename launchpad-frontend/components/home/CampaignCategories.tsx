import {
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
  PhotoIcon,
  RocketLaunchIcon,
  FingerPrintIcon,
  BuildingLibraryIcon,
  GlobeAmericasIcon,
  SunIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useState } from "react";

const categories = [
  {
    name: "DeFi",
    icon: CurrencyDollarIcon,
    description:
      "Lending protocols, DEXs, yield optimization, insurance protocols",

    textColor: "text-blue-600",
  },
  {
    name: "Infrastructure",
    icon: WrenchScrewdriverIcon,
    description:
      "Layer 1/2 solutions, developer tools, oracles, security solutions",

    textColor: "text-blue-600",
  },
  {
    name: "DAOs",
    icon: UserGroupIcon,
    description:
      "Community organizations, protocol governance, investment DAOs, coordination tools",

    textColor: "text-blue-600",
  },
  {
    name: "NFTs",
    icon: PhotoIcon,
    description:
      "Marketplaces, creator platforms, metaverse assets, gaming assets",

    textColor: "text-blue-600",
  },
  {
    name: "Gaming",
    icon: RocketLaunchIcon,
    description:
      "Play-to-earn, virtual worlds, gaming guilds, gaming infrastructure",

    textColor: "text-blue-600",
  },
  {
    name: "Identity",
    icon: FingerPrintIcon,
    description:
      "Decentralized identity, social platforms, reputation systems, privacy tools",

    textColor: "text-blue-600",
  },
  {
    name: "RWA",
    icon: BuildingLibraryIcon,
    description:
      "Tokenized real estate, carbon credits, commodities, securities",

    textColor: "text-blue-600",
  },
  {
    name: "Public Goods",
    icon: GlobeAmericasIcon,
    description:
      "Protocol research, open-source infrastructure, education initiatives",

    textColor: "text-blue-600",
  },
  {
    name: "Climate",
    icon: SunIcon,
    description:
      "Regenerative finance (ReFi), climate tech, impact measurement, green crypto",

    textColor: "text-blue-600",
  },
  {
    name: "Enterprise",
    icon: BuildingOfficeIcon,
    description: "Enterprise and institutional blockchain solutions",

    textColor: "text-blue-600",
  },
];

export default function CampaignCategories() {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);
  return (
    <section className="py-12 bg-white/10">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">
          Every Block in the Chain: Find Your Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 overflow-visible">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/campaigns?category=${encodeURIComponent(category.name)}`}
              className="relative group cursor-pointer h-full"
            >
              <div
                className={`p-4 rounded-lg bg-white/10 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)] hover:shadow-[0_0_15px_rgba(191,219,254,0.3)] border border-gray-100 transition-all duration-300 hover:scale-105 h-full flex flex-col overflow-visible`}
              >
                <div className="flex flex-col items-center text-center flex-grow">
                  <category.icon
                    className={`w-8 h-8 ${category.textColor} mb-2`}
                  />
                  <h3 className="text-base sm:text-lg font-semibold mb-1 text-gray-900">
                    {category.name}
                  </h3>
                  {/* Desktop description */}
                  <p className="text-xs sm:text-sm text-gray-600 hidden md:block">
                    {category.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
