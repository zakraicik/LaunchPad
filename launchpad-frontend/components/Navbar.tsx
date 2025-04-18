import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import CustomConnectButton from './ConnectButton'
import {
  WalletIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  UsersIcon,
  ChartBarIcon,
  DocumentTextIcon,
  Bars3Icon,
  XMarkIcon,
  RocketLaunchIcon,
  CurrencyDollarIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'
import { isAdmin } from '../utils/admin'
import { useFirebaseAuth } from '../hooks/useFirebaseAuth'

export default function Navbar () {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, isLoading } = useFirebaseAuth()

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Discover', href: '/campaigns' },
    { name: 'About', href: '/about' }
  ]

  const accountNavigation = [
    {
      name: 'My Campaigns',
      href: '/campaigns/my',
      icon: RocketLaunchIcon
    },
    { name: 'Contributions', href: '/contributions', icon: WalletIcon }
  ]

  const adminNavigation = [
    {
      name: 'Token Management',
      href: '/admin/token-management',
      icon: CurrencyDollarIcon
    },
    {
      name: 'Platform Admins',
      href: '/admin/platform-admins',
      icon: ShieldCheckIcon
    },
    {
      name: 'Fee Management',
      href: '/admin/fee-management',
      icon: BanknotesIcon
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

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [router.pathname])

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

          {/* Desktop Navigation */}
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

          {/* Mobile menu button */}
          <div className='flex items-center space-x-4 md:hidden'>
            <div className='flex items-center gap-2'>
              <CustomConnectButton />
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className='inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors'
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className='block h-6 w-6' />
              ) : (
                <Bars3Icon className='block h-6 w-6' />
              )}
            </button>
          </div>

          {/* Desktop Connect Button */}
          <div className='hidden md:block flex-shrink-0'>
            <div className='flex items-center gap-2'>
              <CustomConnectButton />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className='md:hidden border-t border-gray-100'>
          <div className='px-2 pt-2 pb-3 space-y-1'>
            {/* Main Navigation */}
            {navigation.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}

            {/* Account Navigation */}
            {shouldShowAccount && (
              <>
                <div className='pt-4 pb-2'>
                  <div className='px-3'>
                    <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Account
                    </p>
                  </div>
                  {accountNavigation.map(item => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`block px-3 py-2 rounded-md text-base font-medium ${
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      } flex items-center`}
                    >
                      <item.icon className='w-5 h-5 mr-3' />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* Admin Navigation */}
            {shouldShowAdmin && (
              <>
                <div className='pt-4 pb-2'>
                  <div className='px-3'>
                    <p className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Admin
                    </p>
                  </div>
                  {adminNavigation.map(item => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`block px-3 py-2 rounded-md text-base font-medium ${
                        isActive(item.href)
                          ? 'bg-purple-50 text-purple-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      } flex items-center`}
                    >
                      <item.icon className='w-5 h-5 mr-3' />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
