import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  WalletIcon,
  PlusCircleIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  UsersIcon,
  ChartBarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { isAdmin } from '../utils/admin'

export default function Navbar () {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Discover', href: '/campaigns' },
    { name: 'About', href: '/about' }
  ]

  const accountNavigation = [
    { name: 'Contributions', href: '/account', icon: WalletIcon },
    { name: 'Campaigns', href: '/campaigns/manage', icon: PlusCircleIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon }
  ]

  const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: ChartBarIcon },
    { name: 'User Management', href: '/admin/users', icon: UsersIcon },
    {
      name: 'Campaign Review',
      href: '/admin/campaigns',
      icon: DocumentTextIcon
    }
  ]

  const isActive = (path: string) => router.pathname === path

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const accountDropdown = document.getElementById('account-dropdown')
      const adminDropdown = document.getElementById('admin-dropdown')

      if (accountDropdown && !accountDropdown.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (adminDropdown && !adminDropdown.contains(event.target as Node)) {
        setIsAdminDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Don't render wallet-dependent elements until client-side hydration is complete
  const shouldShowAccount = mounted && isConnected
  const shouldShowAdmin = mounted && isConnected && isAdmin(address)

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

            {/* Account Dropdown */}
            {shouldShowAccount && (
              <div className='relative' id='account-dropdown'>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className='inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors'
                >
                  <span>Account</span>
                  <ChevronDownIcon className='w-4 h-4 ml-1' />
                </button>

                {isDropdownOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100'>
                    {accountNavigation.map(item => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        } flex items-center`}
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <item.icon className='w-4 h-4 mr-2' />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin Dropdown */}
            {shouldShowAdmin && (
              <div className='relative' id='admin-dropdown'>
                <button
                  onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                  className='inline-flex items-center px-3 py-1.5 rounded-lg bg-purple-50 text-gray-600 hover:text-purple-600 transition-colors'
                >
                  <ShieldCheckIcon className='w-4 h-4 mr-2' />
                  <span>Admin</span>
                  <ChevronDownIcon className='w-4 h-4 ml-1' />
                </button>

                {isAdminDropdownOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100'>
                    {adminNavigation.map(item => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-purple-50 text-purple-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        } flex items-center`}
                        onClick={() => setIsAdminDropdownOpen(false)}
                      >
                        <item.icon className='w-4 h-4 mr-2' />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
