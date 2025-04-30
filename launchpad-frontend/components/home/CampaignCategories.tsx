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

const categories = [
  {
    name: "DeFi",
    icon: CurrencyDollarIcon,
    description:
      "Lending protocols, DEXs, yield optimization, insurance protocols",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Infrastructure",
    icon: WrenchScrewdriverIcon,
    description:
      "Layer 1/2 solutions, developer tools, oracles, security solutions",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "DAOs",
    icon: UserGroupIcon,
    description:
      "Community organizations, protocol governance, investment DAOs, coordination tools",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "NFTs",
    icon: PhotoIcon,
    description:
      "Marketplaces, creator platforms, metaverse assets, gaming assets",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Gaming",
    icon: RocketLaunchIcon,
    description:
      "Play-to-earn, virtual worlds, gaming guilds, gaming infrastructure",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Identity",
    icon: FingerPrintIcon,
    description:
      "Decentralized identity, social platforms, reputation systems, privacy tools",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "RWA",
    icon: BuildingLibraryIcon,
    description:
      "Tokenized real estate, carbon credits, commodities, securities",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Public Goods",
    icon: GlobeAmericasIcon,
    description:
      "Protocol research, open-source infrastructure, education initiatives",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Climate",
    icon: SunIcon,
    description:
      "Regenerative finance (ReFi), climate tech, impact measurement, green crypto",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    name: "Enterprise",
    icon: BuildingOfficeIcon,
    description: "Enterprise and institutional blockchain solutions",
    color: "bg-blue-50",
    textColor: "text-blue-600",
  },
];

export default function CampaignCategories() {
  return (
    <section className="py-12 bg-white/0">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">
          Campaign Categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/campaigns?category=${encodeURIComponent(category.name)}`}
              className="relative group cursor-pointer h-full"
            >
              <div
                className={`p-4 rounded-lg ${category.color} border border-gray-100 transition-all duration-300 hover:scale-105 hover:shadow-md h-full flex flex-col`}
              >
                <div className="flex flex-col items-center text-center flex-grow">
                  <category.icon
                    className={`w-8 h-8 ${category.textColor} mb-3`}
                  />
                  <h3 className="text-lg font-semibold mb-1 text-gray-900">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-600">
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
