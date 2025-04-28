import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import CustomConnectButton from './ConnectButton'
import {
  WalletIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  Bars3Icon,
  XMarkIcon,
  RocketLaunchIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  UserIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { useIsAdmin } from '../utils/admin'
import { useFirebaseAuth } from '../hooks/useFirebaseAuth'
import { useHydration } from '../pages/_app'

export default function Navbar() {
  const { isHydrated } = useHydration()
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, isLoading } = useFirebaseAuth()
  const initialRenderRef = useRef(true)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Discover', href: '/campaigns?category=all' },
    { name: 'About', href: '/about' }
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
    },
    {
      name: 'Platform Metrics',
      href: '/admin/platform-metrics',
      icon: ChartBarIcon
    }
  ]

  const accountNavigation = [
    {
      name: 'My Campaigns',
      href: '/campaigns/my',
      icon: RocketLaunchIcon
    },
    { 
      name: 'My Contributions', 
      href: '/account/contributions', 
      icon: WalletIcon 
    },
    {
      name: 'My Refunds',
      href: '/account/refunds',
      icon: ArrowPathIcon
    },
    {
      name: 'Creator Analytics',
      href: '/account/creator-analytics',
      icon: ChartBarIcon
    }
  ]

  const isActive = (path: string) => {
    // For exact matches (like Home and About)
    if (router.pathname === path) return true
    
    // For the Discover page
    if (path.startsWith('/campaigns?') && router.pathname === '/campaigns') return true
    
    // For nested routes (e.g., /campaigns/my, /account/contributions)
    if (path === '/campaigns/my' && router.pathname === '/campaigns/my') return true
    if (path === '/account/contributions' && router.pathname === '/account/contributions') return true
    if (path === '/admin/token-management' && router.pathname === '/admin/token-management') return true
    if (path === '/admin/platform-admins' && router.pathname === '/admin/platform-admins') return true
    if (path === '/admin/fee-management' && router.pathname === '/admin/fee-management') return true
    
    return false
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isHydrated) return

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
  }, [isHydrated])

  // Close mobile menu on navigation
  useEffect(() => {
    if (!isHydrated) return

    // Skip the first render to avoid state updates during hydration
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      return
    }

    setIsMobileMenuOpen(false)
  }, [router.pathname, isHydrated])

  // Handle dropdown toggles
  const handleDropdownToggle = (type: 'account' | 'admin') => {
    if (type === 'account') {
      setIsDropdownOpen(prev => !prev)
      setIsAdminDropdownOpen(false)
    } else {
      setIsAdminDropdownOpen(prev => !prev)
      setIsDropdownOpen(false)
    }
  }

  // Handle mobile menu toggle
  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev)
  }

  // Keep relevant dropdown open if on one of its pages
  useEffect(() => {
    if (!isHydrated) return
    
    if (typeof window !== 'undefined') {
      const isPageRefresh = performance.navigation && 
        performance.navigation.type === performance.navigation.TYPE_RELOAD
      
      if (isPageRefresh || !sessionStorage.getItem('navInitialized')) {
        setIsDropdownOpen(false)
        setIsAdminDropdownOpen(false)
        sessionStorage.setItem('navInitialized', 'true')
        return
      }
    }
    
    const isOnAccountPage = accountNavigation.some(item => isActive(item.href))
    const isOnAdminPage = adminNavigation.some(item => isActive(item.href))
    
    if (isOnAccountPage) {
      setIsDropdownOpen(true)
      setIsAdminDropdownOpen(false)
    } else if (isOnAdminPage) {
      setIsAdminDropdownOpen(true)
      setIsDropdownOpen(false)
    } else {
      setIsDropdownOpen(false)
      setIsAdminDropdownOpen(false)
    }
  }, [router.pathname, isHydrated])

  // Don't render wallet-dependent elements until client-side hydration is complete
  const shouldShowAccount = isHydrated && isConnected
  const shouldShowAdmin = isHydrated && isConnected && isAdmin && !isLoadingAdmin

  // Return a simple placeholder during server-side rendering
  if (!isHydrated) {
    return (
      <nav className='fixed top-0 left-0 right-0 z-50 bg-white/20 backdrop-blur-md shadow-sm border-b border-gray-100'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <Link href='/' className='flex-shrink-0'>
              <span className='text-xl font-bold text-blue-600 drop-shadow-sm'>LaunchPad</span>
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className='fixed top-0 left-0 right-0 z-50 bg-white/20 backdrop-blur-md shadow-sm border-b border-gray-100'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo and Brand */}
          <Link href='/' className='flex-shrink-0'>
            <span className='text-xl font-bold text-blue-600 drop-shadow-sm'>LaunchPad</span>
          </Link>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center space-x-6'>
            {navigation.map(item => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-gray-800 hover:text-blue-600 font-medium transition-colors relative drop-shadow-sm ${
                  isActive(item.href) ? 'text-blue-600 font-semibold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-current' : ''
                }`}
              >
                {item.name}
              </Link>
            ))}

            {/* Account Dropdown */}
            {shouldShowAccount && (
              <div className='relative' id='account-dropdown'>
                <button
                  onClick={() => handleDropdownToggle('account')}
                  className={`inline-flex items-center text-blue-700 font-medium transition-colors hover:text-blue-900 ${accountNavigation.some(item => isActive(item.href)) ? 'font-semibold' : ''}`}
                >
                  <UserIcon className='w-4 h-4 mr-2' />
                  <div className={`relative ${accountNavigation.some(item => isActive(item.href)) ? 'font-semibold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-current' : ''}`}>
                    Account
                  </div>
                  <ChevronDownIcon 
                    className={`w-4 h-4 ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {isDropdownOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100'>
                    {accountNavigation.map(item => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-blue-50 text-blue-600 font-medium underline'
                            : 'text-gray-700 hover:bg-gray-50'
                        } flex items-center`}
                        onClick={() => {
                          setIsDropdownOpen(false)
                          setIsAdminDropdownOpen(false)
                        }}
                      >
                        <item.icon className={`w-4 h-4 mr-2 ${isActive(item.href) ? 'text-blue-600' : ''}`} />
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
                  onClick={() => handleDropdownToggle('admin')}
                  className={`inline-flex items-center text-purple-700 font-medium transition-colors hover:text-purple-900 ${adminNavigation.some(item => isActive(item.href)) ? 'font-semibold' : ''}`}
                >
                  <ShieldCheckIcon className='w-4 h-4 mr-2' />
                  <div className={`relative ${adminNavigation.some(item => isActive(item.href)) ? 'font-semibold after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-current' : ''}`}>
                    Admin
                  </div>
                  <ChevronDownIcon 
                    className={`w-4 h-4 ml-1 transition-transform ${isAdminDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {isAdminDropdownOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100'>
                    {adminNavigation.map(item => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`block px-4 py-2 text-sm ${
                          isActive(item.href)
                            ? 'bg-purple-50 text-purple-600 font-medium underline'
                            : 'text-gray-700 hover:bg-gray-50'
                        } flex items-center`}
                        onClick={() => {
                          setIsDropdownOpen(false)
                          setIsAdminDropdownOpen(false)
                        }}
                      >
                        <item.icon className={`w-4 h-4 mr-2 ${isActive(item.href) ? 'text-purple-600' : ''}`} />
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
              onClick={handleMobileMenuToggle}
              className='inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-white/30 backdrop-blur-sm transition-colors'
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
        <div className='md:hidden bg-white border-t border-gray-100'>
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
