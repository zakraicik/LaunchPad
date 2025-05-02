import { Disclosure, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useHydration } from "../pages/_app";

const faqs = [
  {
    question: "What is LaunchPad?",
    answer:
      "LaunchPad is a decentralized crowdfunding platform that enables Web3 projects to raise funds through community contributions. What makes us unique is that all contributed funds are automatically deposited into Aave to generate yield during the campaign period, creating additional value for both project creators and the platform.",
  },
  {
    question: "How does the funding process work?",
    answer:
      "Project creators set a funding goal and timeline through our smart contract system. Contributors can pledge ERC-20 tokens during the campaign period. These tokens are automatically deposited into Aave to generate yield. If the goal is met, funds plus yield are released to the project (minus platform fees). If not, contributors can request a full refund through our smart contract.",
  },
  {
    question: "What types of tokens can I use to contribute?",
    answer:
      "LaunchPad supports various ERC-20 tokens that are compatible with Aave lending pools. Our TokenRegistry smart contract maintains a list of supported tokens, each with specified minimum contribution amounts. You can view the current list of supported tokens directly on our platform interface.",
  },
  {
    question: "How are fees structured?",
    answer:
      "LaunchPad charges a small percentage fee only on successful campaigns. Currently, our platform fee is 1% (100 basis points) with a maximum cap of 5%. These fees are automatically calculated and distributed by our FeeManager smart contract, which splits funds between the project creator and platform treasury.",
  },
  {
    question: "What happens if a project doesn't meet its funding goal?",
    answer:
      "If a project doesn't reach its funding goal by the deadline, the campaign smart contract automatically transitions to a completed state. Contributors can then trigger a refund request through our platform, which returns their original contribution amount. This process is fully automated and secured by our smart contract system.",
  },
  {
    question: "How do I become a project creator?",
    answer:
      "To create a project, connect your Web3 wallet to LaunchPad and complete our verification process. Once approved, you'll define your funding goal, campaign duration, and select your desired token for contributions. Our CampaignContractFactory will then deploy a unique Campaign smart contract for your project, requiring only a blockchain transaction fee.",
  },
  {
    question: "How does LaunchPad ensure the security of funds?",
    answer:
      "All funds are managed by audited smart contracts with built-in security features including reentrancy protection, role-based access controls, pausable functionality, and thorough validation checks. Campaign funds can only be claimed under specific conditions defined in the smart contract, and all transactions are transparently recorded on the blockchain.",
  },
  {
    question: "How can I track my contributions?",
    answer:
      "All campaign activities are recorded as events on the blockchain through our CampaignEventCollector contract. Our interface shows real-time updates on campaign progress, your contribution amount, and refund status. You can verify all transactions directly on the blockchain for complete transparency.",
  },
  {
    question: "What oversight does LaunchPad have over campaigns?",
    answer:
      "Our platform includes a carefully designed administration system that allows authorized admins to pause functions during emergencies, set admin override flags to protect contributors, and claim funds on behalf of campaigns when justified. All administrative actions are recorded transparently on the blockchain through our PlatformAdmin contract.",
  },
  {
    question: "How does LaunchPad's yield generation benefit me?",
    answer:
      "When you contribute to a campaign, your tokens automatically generate yield through Aave while the campaign is active. For successful campaigns, this additional yield is split between the project creator and the platform according to our predefined fee structure. This creates a more capital-efficient fundraising process that benefits all participants.",
  },
];

export default function FAQ() {
  const { isHydrated } = useHydration();

  // If not hydrated, render a static non-interactive version
  if (!isHydrated) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-gray-600">
              Find answers to common questions about LaunchPad and how it works.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-lg shadow-sm border border-gray-100 shadow-[0_0_10px_rgba(191,219,254,0.2)]"
              >
                <div className="flex w-full justify-between items-center px-6 py-4 text-left text-lg font-medium text-gray-900">
                  <span>{faq.question}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Normal interactive version once hydrated
  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-gray-600">
            Find answers to common questions about LaunchPad and how it works.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Disclosure key={index}>
              {({ open }) => (
                <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-sm border border-gray-100 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
                  <Disclosure.Button className="flex w-full justify-between items-center px-6 py-4 text-left text-lg font-medium text-gray-900 hover:bg-white/10 transition-colors">
                    <span>{faq.question}</span>
                    <ChevronDownIcon
                      className={`${
                        open ? "rotate-180 transform" : ""
                      } h-5 w-5 text-gray-500 transition-transform duration-300 ease-in-out`}
                    />
                  </Disclosure.Button>
                  <Transition
                    enter="transition duration-300 ease-out"
                    enterFrom="transform scale-95 opacity-0"
                    enterTo="transform scale-100 opacity-100"
                    leave="transition duration-200 ease-out"
                    leaveFrom="transform scale-100 opacity-100"
                    leaveTo="transform scale-95 opacity-0"
                  >
                    <Disclosure.Panel className="px-6 pb-4 text-gray-600">
                      {faq.answer}
                    </Disclosure.Panel>
                  </Transition>
                </div>
              )}
            </Disclosure>
          ))}
        </div>
      </div>
    </div>
  );
}
