import { useFirebaseAuth } from '../../hooks/useFirebaseAuth'
import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'

export default function AuthStatus () {
  const { user, isLoading, error } = useFirebaseAuth()
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything until after hydration
  if (!mounted) return null

  // Not connected to wallet - show nothing
  if (!address) return null

  return (
    <div className='flex items-center gap-2'>
      {isLoading ? (
        // Loading state - yellow pulse
        <div className='relative'>
          <div className='w-2.5 h-2.5 bg-yellow-400 rounded-full'></div>
          <div className='absolute top-0 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping'></div>
        </div>
      ) : error ? (
        // Error state - red
        <div className='relative group'>
          <div className='w-2.5 h-2.5 bg-red-500 rounded-full'></div>
          <div className='absolute bottom-full mb-2 hidden group-hover:block bg-red-100 text-red-700 text-xs rounded-md py-1 px-2 whitespace-nowrap'>
            {error}
          </div>
        </div>
      ) : user ? (
        // Authenticated - green
        <div className='relative group'>
          <div className='w-2.5 h-2.5 bg-green-500 rounded-full'></div>
          <div className='absolute bottom-full mb-2 hidden group-hover:block bg-green-100 text-green-700 text-xs rounded-md py-1 px-2 whitespace-nowrap'>
            Firebase authenticated
          </div>
        </div>
      ) : (
        // Connected but not authenticated - gray
        <div className='relative group'>
          <div className='w-2.5 h-2.5 bg-gray-400 rounded-full'></div>
          <div className='absolute bottom-full mb-2 hidden group-hover:block bg-gray-100 text-gray-700 text-xs rounded-md py-1 px-2 whitespace-nowrap'>
            Not authenticated with Firebase
          </div>
        </div>
      )}
    </div>
  )
}
