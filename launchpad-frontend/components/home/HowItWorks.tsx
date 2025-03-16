import {
  BanknotesIcon,
  ArrowPathIcon,
  ChartBarSquareIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline'

const steps = [
  {
    title: 'Contribute to Campaigns',
    description:
      'Choose a campaign you want to support and contribute funds using cryptocurrency',
    icon: BanknotesIcon
  },
  {
    title: 'Automatic Yield Generation',
    description:
      'Your contribution is automatically deployed to generate yield through DeFi protocols',
    icon: ArrowPathIcon
  },
  {
    title: 'Transparent Tracking',
    description:
      'Monitor the yield generated and how it supports the campaign in real-time',
    icon: ChartBarSquareIcon
  },
  {
    title: 'Sustainable Impact',
    description:
      'Your initial contribution keeps working to support the cause through generated yields',
    icon: HandRaisedIcon
  }
]

export default function HowItWorks () {
  return (
    <section className='py-16 bg-gradient-to-b from-blue-50 to-white'>
      <div className='container mx-auto px-4'>
        <div className='max-w-3xl mx-auto text-center mb-12'>
          <h2 className='text-3xl font-bold mb-4'>How It Works</h2>
          <p className='text-xl text-gray-600'>
            Our innovative yield-generation feature ensures your contribution
            has a lasting impact
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative'>
          {steps.map((step, index) => (
            <div key={step.title} className='relative'>
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className='hidden lg:block absolute left-1/2 right-0 top-12 h-0.5 bg-blue-200 -translate-y-1/2 transform'
                  style={{ width: '100%' }}
                />
              )}

              <div className='relative z-10 flex flex-col items-center'>
                {/* Icon container with background */}
                <div className='mb-6 bg-white p-2 rounded-full'>
                  <div className='p-3 rounded-full bg-blue-100'>
                    <step.icon className='w-8 h-8 text-blue-600' />
                  </div>
                </div>

                {/* Content */}
                <h3 className='text-xl font-semibold text-center mb-2'>
                  {step.title}
                </h3>
                <p className='text-gray-600 text-center'>{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className='mt-12 max-w-2xl mx-auto bg-blue-50 rounded-lg p-6'>
          <h3 className='text-xl font-semibold mb-4 text-center'>
            Why Yield Generation Matters
          </h3>
          <p className='text-gray-600 mb-4'>
            Traditional donations are one-time contributions. Our platform
            leverages DeFi protocols to generate continuous yields from your
            initial contribution, creating a sustainable source of funding for
            the causes you care about.
          </p>
          <p className='text-gray-600'>
            Your contribution remains intact while the generated yields provide
            ongoing support, maximizing the impact of your donation over time.
          </p>
        </div>
      </div>
    </section>
  )
}
