import ConnectButton from '../components/ConnectButton'
import FeaturedCampaigns from '../components/home/FeaturedCampaigns'
import CampaignCategories from '../components/home/CampaignCategories'
import Statistics from '../components/home/Statistics'
import HowItWorks from '../components/home/HowItWorks'

export default function Home () {
  return (
    <main className='min-h-screen bg-white'>
      {/* Hero Section */}
      <section className='bg-gradient-to-b from-blue-50 to-white py-20'>
        <div className='container mx-auto px-4'>
          <div className='max-w-4xl mx-auto text-center'>
            <h1 className='text-5xl font-bold mb-6'>
              Empowering Change Through Sustainable Funding
            </h1>
            <p className='text-xl text-gray-600 mb-8'>
              Support meaningful causes while generating sustainable yields.
              Your contribution keeps on giving.
            </p>
            <ConnectButton />
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      <FeaturedCampaigns />

      {/* Campaign Categories */}
      <CampaignCategories />

      {/* Statistics */}
      <Statistics />

      {/* How It Works */}
      <HowItWorks />
    </main>
  )
}
