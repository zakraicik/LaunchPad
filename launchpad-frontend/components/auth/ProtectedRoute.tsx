import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute ({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    }
  }, [isConnected, router])

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
