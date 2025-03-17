import {
  BanknotesIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ArrowPathIcon,
  LockClosedIcon,
  ScaleIcon
} from '@heroicons/react/24/outline'

export default function About () {
  return (
    <div className='min-h-screen bg-gray-50 py-12'>
      <div className='container mx-auto px-4'>
        {/* Hero Section */}
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-bold mb-4'>About LaunchPad</h1>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Revolutionizing crowdfunding through sustainable yield generation,
            ensuring long-term impact for meaningful projects.
          </p>
        </div>

        {/* Yield Generation Section */}
        <div className='bg-white rounded-lg shadow-sm p-8 mb-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <ChartBarIcon className='h-8 w-8 text-blue-600 mr-3' />
            How Yield Generation Works
          </h2>
          <div className='grid md:grid-cols-2 gap-8'>
            <div className='space-y-4'>
              <p className='text-gray-600'>
                Our platform leverages DeFi protocols to generate sustainable
                yields from campaign contributions. Here's how it works:
              </p>
              <ol className='space-y-4 list-decimal list-inside text-gray-600'>
                <li>
                  Contributors provide capital to campaigns they believe in
                </li>
                <li>Funds are deployed to vetted DeFi protocols</li>
                <li>
                  Generated yields continuously support the campaign's cause
                </li>
                <li>
                  Original contribution remains intact and can be withdrawn
                </li>
              </ol>
            </div>
            <div className='bg-blue-50 rounded-lg p-6'>
              <h3 className='font-semibold mb-3'>Current Yield Sources</h3>
              <ul className='space-y-3'>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Lending protocols (Aave, Compound)</span>
                </li>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Liquidity provision</span>
                </li>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Staking rewards</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Fees and Revenue Section */}
        <div className='bg-white rounded-lg shadow-sm p-8 mb-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <BanknotesIcon className='h-8 w-8 text-blue-600 mr-3' />
            Platform Fees & Revenue Model
          </h2>
          <div className='grid md:grid-cols-2 gap-8'>
            <div>
              <h3 className='font-semibold mb-4'>Fee Structure</h3>
              <div className='space-y-4'>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Base Platform Fee</p>
                    <p className='text-gray-600'>2% of generated yield</p>
                  </div>
                </div>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Campaign Creation</p>
                    <p className='text-gray-600'>Free</p>
                  </div>
                </div>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Contribution Fee</p>
                    <p className='text-gray-600'>No additional fees</p>
                  </div>
                </div>
              </div>
            </div>
            <div className='bg-blue-50 rounded-lg p-6'>
              <h3 className='font-semibold mb-3'>Revenue Allocation</h3>
              <ul className='space-y-3'>
                <li className='flex items-center'>
                  <div className='w-full'>
                    <div className='flex justify-between mb-1'>
                      <span>Campaign Beneficiary</span>
                      <span className='font-medium'>95%</span>
                    </div>
                    <div className='w-full bg-blue-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: '95%' }}
                      ></div>
                    </div>
                  </div>
                </li>
                <li className='flex items-center mt-4'>
                  <div className='w-full'>
                    <div className='flex justify-between mb-1'>
                      <span>Platform Operations</span>
                      <span className='font-medium'>2%</span>
                    </div>
                    <div className='w-full bg-blue-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: '2%' }}
                      ></div>
                    </div>
                  </div>
                </li>
                <li className='flex items-center mt-4'>
                  <div className='w-full'>
                    <div className='flex justify-between mb-1'>
                      <span>Protocol Development</span>
                      <span className='font-medium'>3%</span>
                    </div>
                    <div className='w-full bg-blue-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: '3%' }}
                      ></div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className='bg-white rounded-lg shadow-sm p-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <ShieldCheckIcon className='h-8 w-8 text-blue-600 mr-3' />
            Security Measures
          </h2>
          <div className='grid md:grid-cols-3 gap-6'>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <LockClosedIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Smart Contract Security</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• Audited by leading security firms</li>
                <li>• Open-source and verified contracts</li>
                <li>• Multi-signature governance</li>
              </ul>
            </div>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <ShieldCheckIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Risk Management</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• Diversified yield sources</li>
                <li>• Protocol risk assessment</li>
                <li>• Insurance coverage</li>
              </ul>
            </div>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <ShieldCheckIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Campaign Verification</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• KYC for campaign creators</li>
                <li>• Project milestone tracking</li>
                <li>• Transparent reporting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
