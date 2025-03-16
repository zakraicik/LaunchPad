import Link from 'next/link'
import { useRouter } from 'next/router'
import ConnectButton from './ConnectButton'

export default function Navbar () {
  const router = useRouter()
  const currentPath = router.pathname

  return (
    <nav className='bg-white shadow-sm'>
      <div className='container mx-auto px-4'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo and Brand */}
          <Link href='/' className='flex items-center'>
            <span className='text-xl font-bold text-blue-600'>LaunchPad</span>
          </Link>

          {/* Navigation Links */}
          <div className='hidden md:flex items-center space-x-8'>
            <Link
              href='/'
              className={`text-gray-600 hover:text-blue-600 transition-colors ${
                router.pathname === '/' ? 'text-blue-600 font-medium' : ''
              }`}
            >
              Home
            </Link>
            <Link
              href='/campaigns'
              className={`text-gray-600 hover:text-blue-600 transition-colors ${
                router.pathname === '/campaigns'
                  ? 'text-blue-600 font-medium'
                  : ''
              }`}
            >
              Discover Campaigns
            </Link>
            <Link
              href='/about'
              className={`text-gray-600 hover:text-blue-600 transition-colors ${
                router.pathname === '/about' ? 'text-blue-600 font-medium' : ''
              }`}
            >
              About
            </Link>
          </div>

          {/* Connect Wallet Button */}
          <div className='flex items-center'>
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
