import {
  BanknotesIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ArrowPathIcon,
  LockClosedIcon,
  ScaleIcon
} from '@heroicons/react/24/outline'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function About () {
  // Chart data and options
  const chartData = {
    labels: ['0', '30', '60', '90', '120', '150', '180', '210', '240', '270', '300', '330', '360'],
    datasets: [
      {
        label: 'Platform Fees',
        data: [10.00, 10.02, 10.04, 10.06, 10.08, 10.10, 10.12, 10.14, 10.17, 10.19, 10.21, 10.23, 10.25],
        borderColor: 'rgb(59, 130, 246)', // Tailwind blue-600
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        borderWidth: 2
      },
      {
        label: 'Net Fees - Creator',
        data: [10.00, 7.96, 5.92, 3.88, 1.83, 0, 0, 0, 0, 0, 0, 0, 0],
        borderColor: 'rgb(239, 68, 68)', // Tailwind red-600
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        borderWidth: 2
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 12, // Set max to show a bit of space above the highest value
        title: {
          display: true,
          text: 'Fees ($)',
          font: {
            size: 14
          }
        },
        ticks: {
          callback: (value: any) => `$${value.toFixed(2)}`
        }
      },
      x: {
        title: {
          display: true,
          text: 'Campaign Duration (Days)',
          font: {
            size: 14
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
        }
      }
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 py-12'>
      <div className='container mx-auto px-4'>
        {/* Hero Section */}
        <div className='text-center mb-16'>
          <h1 className='text-4xl font-bold mb-4'>About LaunchPad</h1>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Revolutionizing crowdfunding by generating sustainable yields through DeFi integration, making platform fees effectively self-funded.
          </p>
        </div>

        {/* Fee Structure Chart Section */}
        <div className='bg-white rounded-lg shadow-sm p-8 mb-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <BanknotesIcon className='h-8 w-8 text-blue-600 mr-3' />
            Fee Structure
          </h2>
          <div className='mb-4'>
            <p className='text-gray-600'>
              Our innovative fee structure ensures that longer campaigns benefit from reduced net fees through yield generation:
            </p>
          </div>
          <div className='h-[400px] w-full'>
            <Line data={chartData} options={chartOptions} />
          </div>
          <div className='mt-6 bg-blue-50 rounded-lg p-4'>
            <h3 className='font-semibold mb-2'>Key Points:</h3>
            <ul className='space-y-2 text-gray-600'>
              <li className='flex items-center'>
                <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                <span>Platform fees start at $10 and increase slightly with yield</span>
              </li>
              <li className='flex items-center'>
                <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                <span>Net fees decrease linearly as yield accumulates</span>
              </li>
              <li className='flex items-center'>
                <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                <span>Campaigns running 150+ days achieve zero net fees through yield generation</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Core Features Section */}
        <div className='bg-white rounded-lg shadow-sm p-8 mb-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <ChartBarIcon className='h-8 w-8 text-blue-600 mr-3' />
            How It Works
          </h2>
          <div className='grid md:grid-cols-2 gap-8'>
            <div className='space-y-4'>
              <p className='text-gray-600'>
                LaunchPad combines crowdfunding with DeFi to create a sustainable funding model:
              </p>
              <ol className='space-y-4 list-decimal list-inside text-gray-600'>
                <li>
                  Campaign creators set up their funding goals with minimal platform fees
                </li>
                <li>Contributors donate directly to causes they believe in</li>
                <li>
                  Funds are automatically deployed to Aave for yield generation
                </li>
                <li>
                  Generated yields cover platform fees while preserving the original capital
                </li>
              </ol>
            </div>
            <div className='bg-blue-50 rounded-lg p-6'>
              <h3 className='font-semibold mb-3'>Key Benefits</h3>
              <ul className='space-y-3'>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Self-funded platform fees through yield</span>
                </li>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Direct funding to causes</span>
                </li>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Sustainable yield generation</span>
                </li>
                <li className='flex items-center'>
                  <ArrowPathIcon className='h-5 w-5 text-blue-600 mr-2' />
                  <span>Capital preservation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* DeFi Integration Section */}
        <div className='bg-white rounded-lg shadow-sm p-8 mb-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <BanknotesIcon className='h-8 w-8 text-blue-600 mr-3' />
            DeFi Integration
          </h2>
          <div className='grid md:grid-cols-2 gap-8'>
            <div>
              <h3 className='font-semibold mb-4'>Aave Integration</h3>
              <div className='space-y-4'>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Automated Yield Generation</p>
                    <p className='text-gray-600'>Funds are automatically deployed to Aave for optimal yield</p>
                  </div>
                </div>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Multiple Token Support</p>
                    <p className='text-gray-600'>Support for various ERC20 tokens through our Token Registry</p>
                  </div>
                </div>
                <div className='flex items-start space-x-3 p-4 bg-gray-50 rounded-lg'>
                  <ScaleIcon className='h-6 w-6 text-blue-600 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>Secure Fund Management</p>
                    <p className='text-gray-600'>Funds are locked in Aave until campaign completion (goal reached or deadline passed)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className='bg-blue-50 rounded-lg p-6'>
              <h3 className='font-semibold mb-3'>Yield Distribution</h3>
              <ul className='space-y-3'>
                <li className='flex items-center'>
                  <div className='w-full'>
                    <div className='flex justify-between mb-1'>
                      <span>Campaign Beneficiary</span>
                      <span className='font-medium'>99%</span>
                    </div>
                    <div className='w-full bg-blue-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: '99%' }}
                      ></div>
                    </div>
                  </div>
                </li>
                <li className='flex items-center mt-4'>
                  <div className='w-full'>
                    <div className='flex justify-between mb-1'>
                      <span>Platform Operations</span>
                      <span className='font-medium'>1%</span>
                    </div>
                    <div className='w-full bg-blue-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: '1%' }}
                      ></div>
                    </div>
                  </div>
                </li>
                <li className='mt-4 text-gray-600'>
                  Platform fees are covered by a small portion of the generated yield, ensuring sustainable operations while maximizing benefits to campaign beneficiaries.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className='bg-white rounded-lg shadow-sm p-8'>
          <h2 className='text-2xl font-bold mb-6 flex items-center'>
            <ShieldCheckIcon className='h-8 w-8 text-blue-600 mr-3' />
            Security & Transparency
          </h2>
          <div className='grid md:grid-cols-3 gap-6'>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <LockClosedIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Smart Contract Security</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• Open-source and verified contracts</li>
                <li>• Built on battle-tested protocols</li>
                <li>• Regular security audits</li>
              </ul>
            </div>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <ShieldCheckIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Fund Safety</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• Non-custodial design</li>
                <li>• Direct Aave integration</li>
                <li>• Transparent fund tracking</li>
              </ul>
            </div>
            <div className='p-6 bg-gray-50 rounded-lg'>
              <ShieldCheckIcon className='h-8 w-8 text-blue-600 mb-4' />
              <h3 className='font-semibold mb-2'>Transparency</h3>
              <ul className='text-gray-600 space-y-2'>
                <li>• Real-time yield tracking</li>
                <li>• On-chain verification</li>
                <li>• Open contribution history</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
