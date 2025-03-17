'use client'

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

// Dummy data - replace with real data later
const dummyCampaigns = [
  {
    id: 1,
    title: 'Clean Energy Initiative',
    description: 'Supporting renewable energy projects with yield generation',
    image: '/images/placeholder1.jpg',
    target: 100000,
    raised: 75000
  },
  {
    id: 2,
    title: 'Education for All',
    description: 'Providing educational resources through sustainable funding',
    image: '/images/placeholder2.jpg',
    target: 50000,
    raised: 35000
  },
  {
    id: 3,
    title: 'Ocean Cleanup Project',
    description: 'Leveraging yield farming to fund ocean cleanup initiatives',
    image: '/images/placeholder3.jpg',
    target: 75000,
    raised: 45000
  }
]

export default function FeaturedCampaigns () {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextSlide = () => {
    setCurrentIndex(prevIndex =>
      prevIndex === dummyCampaigns.length - 1 ? 0 : prevIndex + 1
    )
  }

  const prevSlide = () => {
    setCurrentIndex(prevIndex =>
      prevIndex === 0 ? dummyCampaigns.length - 1 : prevIndex - 1
    )
  }

  return (
    <section className='relative py-12 bg-white'>
      <div className='container mx-auto px-4'>
        <h2 className='text-3xl font-bold mb-8 text-center'>
          Featured Campaigns
        </h2>

        <div className='relative overflow-hidden'>
          <div
            className='flex transition-transform duration-500 ease-in-out'
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {dummyCampaigns.map(campaign => (
              <Link
                key={campaign.id}
                href={`/campaigns?id=${campaign.id}`}
                className='w-full flex-shrink-0 px-4 cursor-pointer'
              >
                <div className='bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow'>
                  <div className='aspect-w-16 aspect-h-9 bg-gray-200'>
                    {/* Replace with actual Image component when images are available */}
                    <div className='w-full h-64 bg-gray-200'></div>
                  </div>
                  <div className='p-6'>
                    <h3 className='text-xl font-semibold mb-2'>
                      {campaign.title}
                    </h3>
                    <p className='text-gray-600 mb-4'>{campaign.description}</p>
                    <div className='space-y-2'>
                      <div className='w-full bg-gray-200 rounded-full h-2'>
                        <div
                          className='bg-blue-600 h-2 rounded-full'
                          style={{
                            width: `${
                              (campaign.raised / campaign.target) * 100
                            }%`
                          }}
                        ></div>
                      </div>
                      <div className='flex justify-between text-sm text-gray-600'>
                        <span>Raised: ${campaign.raised.toLocaleString()}</span>
                        <span>Target: ${campaign.target.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <button
            onClick={prevSlide}
            className='absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow-lg'
          >
            <ChevronLeftIcon className='h-6 w-6' />
          </button>

          <button
            onClick={nextSlide}
            className='absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow-lg'
          >
            <ChevronRightIcon className='h-6 w-6' />
          </button>
        </div>

        {/* View All Campaigns Button */}
        <div className='mt-8 text-center'>
          <Link
            href='/campaigns'
            className='inline-flex items-center px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors'
          >
            View All Campaigns
          </Link>
        </div>
      </div>
    </section>
  )
}
