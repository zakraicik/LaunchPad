import { Disclosure, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useHydration } from "../pages/_app";
import { useState } from "react";

const faqs = [
  {
    question: "What is LaunchPad?",
    answer:
      "LaunchPad is a decentralized crowdfunding platform for Web3 projects. Our unique approach automatically deposits all contributions into AAVE to generate yield during campaigns, helping reduce fees and maximize funds raised.",
  },
  {
    question: "How does the funding process work?",
    answer:
      "Project creators set funding goals, choose a campaign token, and define timelines through our smart contracts. Contributors pledge tokens while campaigns are active.\n\nAll funds generate yield in AAVE throughout the campaign period. We use an all-or-nothing model — campaigns must reach their full funding goal to succeed.",
  },
  {
    question: "How long can campaigns run?",
    answer: (
      <>
        When creating a campaign, project owners specify the duration in days,
        with a maximum limit of one year (365 days). This period starts
        immediately upon campaign creation and cannot be changed afterward. Our
        contracts enforce this timeline to ensure transparency and fairness for
        all participants.
        <br />
        <br />
        Once the end date is reached, the campaign automatically becomes
        ineligible for further contributions, and its status is updated to
        completed on the next interaction.
      </>
    ),
  },
  {
    question:
      "Is there a minimum contribution amount when contributing to a campaign?",
    answer: (
      <>
        Yes, each supported token has a minimum contribution amount configured
        in the TokenRegistry contract. These minimums are set by platform admins
        based on factors like:
        <ul className="list-disc pl-6 mt-2">
          <li>Token value</li>
          <li>Transaction costs</li>
          <li>Protocol efficiency</li>
        </ul>
        The exact minimum is displayed when you're making a contribution and
        varies by token.
      </>
    ),
  },
  {
    question: "What happens if a project reaches its funding goal?",
    answer: (
      <>
        When a campaign succeeds, it enters the claim phase. The project creator
        initiates a claim transaction that:
        <ul className="list-disc pl-6 mt-2">
          <li>Withdraws funds from AAVE</li>
          <li>Deducts platform fees</li>
          <li>
            Transfers the remaining amount directly to the creator's wallet
          </li>
        </ul>
        Once claimed, creators can immediately use these funds for development.
      </>
    ),
  },
  {
    question: "What happens if a project doesn't meet its funding goal?",
    answer: (
      <>
        For unsuccessful campaigns, the project owner must initiate the claim
        process to enable refunds. This action returns the smart contract to a
        state where contributors can reclaim their funds.
        <br />
        <br />
        If a campaign owner fails to do this, platform admins can step in to
        ensure contributors receive their refunds.
      </>
    ),
  },
  {
    question: "What types of tokens can I use to contribute?",
    answer: (
      <>
        LaunchPad uses a managed token registry. Platform admins curate
        supported tokens based on security and liquidity considerations.
        <br />
        <br />
        When creating campaigns, project owners will only see approved tokens in
        the dropdown menu.
      </>
    ),
  },
  {
    question: "How are fees structured?",
    answer: (
      <>
        LaunchPad's platform fee is currently set at 1% (100 basis points).
        Platform admins can adjust this rate between 0% and 5% using the
        FeeManager contract, based on market conditions.
        <br />
        <br />
        For successful campaigns, fees are deducted from the total
        (contributions + yield) before the remainder transfers to the creator's
        wallet. For unsuccessful campaigns, the fee is only applied after
        setting aside the full amount needed for contributor refunds, ensuring
        contributors receive their principal back first.
      </>
    ),
  },
  {
    question: "What chains is LaunchPad deployed on?",
    answer: (
      <>
        LaunchPad is exclusively on Base mainnet. Our core contracts are:
        <ul className="list-disc pl-6 mt-2">
          <li>
            Platform Admin:{" "}
            <span className="font-mono">
              0x435488929685FA6A2Bd8Ab645Ad1df4355dB9D24
            </span>
          </li>
          <li>
            Token Registry:{" "}
            <span className="font-mono">
              0xb1CF2E7fa0FfF4434BA8fee25639Ae5f61e555E3
            </span>
          </li>
          <li>
            Fee Manager:{" "}
            <span className="font-mono">
              0xca21e776f0707aE4D9835b4e4F5a4F23599d37Ef
            </span>
          </li>
          <li>
            Campaign Factory:{" "}
            <span className="font-mono">
              0x1757Bd6c4746A995FddB39c38E2B0019E725f3b1
            </span>
          </li>
          <li>
            Defi Integration Manager:{" "}
            <span className="font-mono">
              0x0F3159eE738f8cc6a3E256d285e36a5999593d9e
            </span>
          </li>
          <li>
            Campaign Event Collector:{" "}
            <span className="font-mono">
              0xD28e9356b9A9AC2b15c34169DbB82CcCF47702d4
            </span>
          </li>
        </ul>
      </>
    ),
  },
  {
    question: "How does LaunchPad ensure the security of funds?",
    answer: (
      <>
        Our smart contracts include multiple security features:
        <ul className="list-disc pl-6 mt-2">
          <li>Reentrancy protection</li>
          <li>Role-based access controls</li>
          <li>Pausable functionality</li>
          <li>Thorough validation checks</li>
        </ul>
        Funds can only be claimed under specific conditions defined in the
        contracts, and all transactions are recorded transparently on-chain.
      </>
    ),
  },
  {
    question: "What oversight does LaunchPad have over campaigns?",
    answer: (
      <>
        Our administration system allows authorized admins to:
        <ul className="list-disc pl-6 mt-2">
          <li>Pause functions during emergencies</li>
          <li>Set override flags to protect contributors</li>
          <li>Claim funds on behalf of campaigns when justified</li>
        </ul>
        All administrative actions are recorded transparently on the blockchain
        through our PlatformAdmin contract.
      </>
    ),
  },
  {
    question:
      "Why is yield generation important for both contributors and campaign owners?",
    answer: (
      <>
        Yield generation benefits everyone on LaunchPad:
        <ul className="list-disc pl-6 mt-2">
          <li>
            <b>For campaign owners:</b> Helps offset platform fees, allowing
            more funds to go directly to project development
          </li>
          <li>
            <b>For contributors:</b> Ensures more of your contribution reaches
            the projects you support through reduced platform costs
          </li>
        </ul>
        <br />
        By integrating with AAVE, LaunchPad creates value that traditional
        crowdfunding platforms simply can't match. Our DeFi integration
        demonstrates our commitment to the growth of the Web3 ecosystem — we're
        not just building on blockchain technology, we're actively supporting
        DeFi protocols that are reshaping the financial landscape.
      </>
    ),
  },
];

export default function FAQ() {
  const { isHydrated } = useHydration();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
            <Disclosure key={index} as="div">
              {({ open }) => {
                const isOpen = openIndex === index;
                return (
                  <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-sm border border-gray-100 shadow-[0_0_10px_rgba(191,219,254,0.2)]">
                    <Disclosure.Button
                      className="flex w-full justify-between items-center px-6 py-4 text-left text-lg font-medium text-gray-900 hover:bg-white/10 transition-colors"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                    >
                      <span>{faq.question}</span>
                      <ChevronDownIcon
                        className={`${
                          isOpen ? "rotate-180 transform" : ""
                        } h-5 w-5 text-gray-500 transition-transform duration-300 ease-in-out`}
                      />
                    </Disclosure.Button>
                    <Transition
                      show={isOpen}
                      enter="transition duration-300 ease-out"
                      enterFrom="transform scale-95 opacity-0"
                      enterTo="transform scale-100 opacity-100"
                      leave="transition duration-200 ease-out"
                      leaveFrom="transform scale-100 opacity-100"
                      leaveTo="transform scale-95 opacity-0"
                    >
                      <Disclosure.Panel className="px-6 pb-4 text-gray-600">
                        {typeof faq.answer === "string"
                          ? faq.answer.split("\n").map((line, i) => (
                              <span key={i}>
                                {line}
                                <br />
                              </span>
                            ))
                          : faq.answer}
                      </Disclosure.Panel>
                    </Transition>
                  </div>
                );
              }}
            </Disclosure>
          ))}
        </div>
      </div>
    </div>
  );
}
