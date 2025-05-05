import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'
import { useHydration } from '../../pages/_app'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isHydrated } = useHydration()
  const router = useRouter()
  const { isConnected } = useAccount()

  // Only attempt to redirect when fully hydrated
  useEffect(() => {
    if (isHydrated && !isConnected) {
      router.push('/')
    }
  }, [isConnected, router, isHydrated])

  // Show a simple loading state during SSR/hydration
  if (!isHydrated) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-600'>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // After hydration, show the connection required message if needed
  if (!isConnected) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-2xl font-semibold mb-4'>
            Wallet Connection Required
          </h2>
          <p className='text-gray-600'>
            Please connect your wallet to access this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
