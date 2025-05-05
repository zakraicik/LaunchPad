import {
  ShieldCheckIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  BuildingLibraryIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    name: "DeFi Integration",
    description:
      "Funds are automatically deposited into Aave to generate yield while campaigns are active, maximizing value for both creators and contributors.",
    icon: SparklesIcon,
  },
  {
    name: "Smart Contract Security",
    description:
      "Built with robust security features including reentrancy guards and strict access controls, ensuring your funds are protected.",
    icon: ShieldCheckIcon,
  },
  {
    name: "Transparent Fees",
    description:
      "Clear and upfront fee structure with no hidden costs. Platform fees are automatically handled by smart contracts.",
    icon: CurrencyDollarIcon,
  },
  {
    name: "Automatic Refunds",
    description:
      "Built-in refund mechanism for unsuccessful campaigns, allowing contributors to easily reclaim their funds.",
    icon: ArrowPathIcon,
  },
  {
    name: "Professional Oversight",
    description:
      "Platform administrators carefully manage token support and provide oversight to ensure platform integrity.",
    icon: BuildingLibraryIcon,
  },
];

export default function About() {
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Decentralized Crowdfunding,{" "}
            <span className="text-blue-600">Powered by DeFi</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            LaunchPad combines traditional crowdfunding with DeFi yield
            generation to offer lower fees for creators and power new web3
            projects.
          </p>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="relative bg-white/80 backdrop-blur-sm p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center mb-4">
                <feature.icon className="h-6 w-6 text-blue-600" />
                <h3 className="ml-3 text-lg font-medium text-gray-900">
                  {feature.name}
                </h3>
              </div>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How It Works Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            How It Works
          </h2>
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                1
              </div>
              <p className="ml-4 text-lg text-gray-600">
                Contributors send supported tokens to campaign smart contracts
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                2
              </div>
              <p className="ml-4 text-lg text-gray-600">
                Funds are automatically deposited into Aave to generate yield
                during the campaign
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                3
              </div>
              <p className="ml-4 text-lg text-gray-600">
                Successful campaigns receive funds plus generated yield (minus
                platform fee)
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                4
              </div>
              <p className="ml-4 text-lg text-gray-600">
                Unsuccessful campaigns allow contributors to request refunds
              </p>
            </div>
          </div>
        </div>

        {/* Token Support Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Supported Tokens
          </h2>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg mb-4">
              LaunchPad currently supports a carefully curated selection of
              tokens for campaigns and contributions. Our platform
              administrators actively manage token support to ensure:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>High liquidity and market stability</li>
              <li>Integration with Aave lending pools</li>
              <li>Reliable price feeds and oracles</li>
              <li>Maximum security for our users</li>
            </ul>
            <p className="mt-4 text-lg">
              The list of supported tokens is regularly reviewed and updated
              based on market conditions and community needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
