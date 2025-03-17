import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WalletIcon } from '@heroicons/react/24/outline'
import { PlusCircleIcon } from '@heroicons/react/24/outline'

export default function Navbar () {
  const router = useRouter()
  const { isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Discover', href: '/campaigns' },
    { name: 'About', href: '/about' }
  ]

  const isActive = (path: string) => router.pathname === path

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render wallet-dependent elements until client-side hydration is complete
  const shouldShowAccount = mounted && isConnected

  return (
    <nav className='bg-white shadow-sm'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo and Brand */}
          <Link href='/' className='flex-shrink-0'>
            <span className='text-xl font-bold text-blue-600'>LaunchPad</span>
          </Link>

          {/* Navigation Links */}
          <div className='hidden md:flex items-center space-x-6'>
            {navigation.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-gray-600 hover:text-blue-600 transition-colors ${
                  isActive(item.href) ? 'text-blue-600 font-medium' : ''
                }`}
              >
                {item.name}
              </Link>
            ))}

            {/* Account Link with Protected State */}
            {shouldShowAccount && (
              <>
                <Link
                  href='/account'
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 transition-colors ${
                    isActive('/account')
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  <WalletIcon className='w-4 h-4 mr-2' />
                  <span>Contributions</span>
                </Link>
                <Link
                  href='/campaigns/manage'
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 transition-colors ${
                    isActive('/campaigns/manage')
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  <PlusCircleIcon className='w-4 h-4 mr-2' />
                  <span>Campaigns</span>
                </Link>
              </>
            )}
          </div>

          {/* Connect Button */}
          <div className='flex-shrink-0'>
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
