import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface FAQItem {
  question: string
  answer: string | string[]
}

interface FAQSection {
  title: string
  items: FAQItem[]
}

export default function FAQ () {
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>(
    {}
  )
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({})

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const toggleItem = (sectionTitle: string, question: string) => {
    const key = `${sectionTitle}-${question}`
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const faqSections: FAQSection[] = [
    {
      title: 'General Platform Questions',
      items: [
        {
          question: 'What is LaunchPad?',
          answer:
            'LaunchPad is a decentralized crowdfunding platform that leverages DeFi protocols to generate sustainable yields for campaigns. Unlike traditional crowdfunding, contributions continue working for the cause through yield generation even after the campaign ends.'
        },
        {
          question:
            'What makes LaunchPad different from traditional crowdfunding?',
          answer: [
            'Sustainable funding through yield generation',
            'Contributors can withdraw their initial contribution',
            'Transparent on-chain tracking of funds',
            'DeFi integration for optimal returns',
            'No platform fees on contributions'
          ]
        },
        {
          question: 'What cryptocurrencies can I use to contribute?',
          answer:
            "LaunchPad supports various tokens including USDC and other major stablecoins. The platform automatically converts your contribution to the campaign's target token through integrated DeFi protocols."
        }
      ]
    },
    {
      title: 'Yield Generation and Distribution',
      items: [
        {
          question: 'How does yield generation work?',
          answer: [
            'Contributions are deployed to vetted DeFi protocols (e.g., Aave, Compound)',
            'Yields are generated through lending, liquidity provision, and staking',
            'Generated yields are automatically harvested and distributed',
            'Early contributors receive higher yield weights (up to 1.5x)',
            '95% of yields go to campaign beneficiaries, 5% to platform operations'
          ]
        },
        {
          question: 'How is yield distributed?',
          answer:
            'Yield distribution is weighted based on contribution timing and amount. Earlier contributors receive higher weights (up to 1.5x for first 25% of campaign duration). Yields are automatically calculated and can be claimed by contributors after the campaign ends.'
        },
        {
          question: 'What are the current yield rates?',
          answer:
            'Yield rates vary based on market conditions and the specific DeFi protocols being utilized. Current rates are displayed on each campaign page and are updated in real-time.'
        }
      ]
    },
    {
      title: 'Contribution and Refund Policies',
      items: [
        {
          question: 'Can I get a refund?',
          answer:
            'Yes, you can request a refund if the campaign does not reach its goal by the deadline. Refunds return your original contribution amount. Note that once a campaign reaches its goal, contributions cannot be refunded.'
        },
        {
          question: "What happens if a campaign doesn't reach its goal?",
          answer: [
            'Campaign is marked as unsuccessful',
            'Contributors can request refunds of their full contribution',
            'No yields will be distributed',
            'Campaign creators cannot claim the funds'
          ]
        },
        {
          question: 'How long do campaigns last?',
          answer:
            'Campaign duration is set by the creator during campaign creation and cannot be modified afterward. The typical duration ranges from 30 to 90 days.'
        }
      ]
    },
    {
      title: 'Creator Guidelines',
      items: [
        {
          question: 'How can I start a campaign?',
          answer: [
            'Connect your wallet',
            'Complete KYC verification',
            'Set campaign details (goal, duration, description)',
            'Choose target token for contributions',
            'Submit for review and approval'
          ]
        },
        {
          question: 'What are the campaign requirements?',
          answer: [
            'Clear project description and goals',
            'Realistic funding target',
            'Valid KYC verification',
            'Detailed plan for fund utilization',
            'Regular progress updates commitment'
          ]
        },
        {
          question: 'Are there any fees for campaign creators?',
          answer:
            'Campaign creation is free. The platform takes 5% of generated yields (2% for operations, 3% for development). There are no fees on the principal contribution amount.'
        }
      ]
    }
  ]

  return (
    <div className='min-h-screen bg-gray-50 py-12'>
      <div className='container mx-auto px-4'>
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-bold mb-4'>
            Frequently Asked Questions
          </h1>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Everything you need to know about LaunchPad's yield-generating
            crowdfunding platform
          </p>
        </div>

        <div className='max-w-4xl mx-auto space-y-6'>
          {faqSections.map(section => (
            <div
              key={section.title}
              className='bg-white rounded-lg shadow-sm overflow-hidden'
            >
              <button
                onClick={() => toggleSection(section.title)}
                className='w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50'
              >
                <h2 className='text-xl font-semibold text-left'>
                  {section.title}
                </h2>
                <ChevronDownIcon
                  className={`h-6 w-6 text-gray-400 transform transition-transform ${
                    openSections[section.title] ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSections[section.title] && (
                <div className='px-6 pb-6'>
                  <div className='space-y-4'>
                    {section.items.map(item => (
                      <div
                        key={item.question}
                        className='border-b border-gray-100 last:border-0'
                      >
                        <button
                          onClick={() =>
                            toggleItem(section.title, item.question)
                          }
                          className='w-full py-4 flex justify-between items-start text-left'
                        >
                          <span className='font-medium pr-8'>
                            {item.question}
                          </span>
                          <ChevronDownIcon
                            className={`h-5 w-5 text-gray-400 transform transition-transform flex-shrink-0 ${
                              openItems[`${section.title}-${item.question}`]
                                ? 'rotate-180'
                                : ''
                            }`}
                          />
                        </button>

                        {openItems[`${section.title}-${item.question}`] && (
                          <div className='pb-4 text-gray-600'>
                            {Array.isArray(item.answer) ? (
                              <ul className='list-disc pl-5 space-y-2'>
                                {item.answer.map((point, index) => (
                                  <li key={index}>{point}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>{item.answer}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
