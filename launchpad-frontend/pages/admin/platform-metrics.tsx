import { useAccount } from 'wagmi'
import { useIsAdmin } from '../../utils/admin'
import { useHydration } from '@/pages/_app'
import { useRouter } from 'next/router'

export default function PlatformMetrics() {
  const router = useRouter()
  const { isHydrated } = useHydration()
  const { address } = useAccount()
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address)

  if (!isHydrated || isLoadingAdmin) {
    return <div>Loading...</div>
  }

  if (!isAdmin) {
    router.push('/')
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Platform Metrics</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Platform metrics dashboard coming soon...</p>
      </div>
    </div>
  )
} 