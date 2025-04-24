import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { generateAvatar } from '../../utils/avatar'
import { shortenAddress } from '../../utils/format'
import { ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ContributorsProps {
  campaignId: string
}

interface Contributor {
  address: string
  avatarUrl: string
}

export default function Contributors({ campaignId }: ContributorsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  useEffect(() => {
    const fetchContributors = async () => {
      if (!campaignId) return

      try {
        setIsLoading(true)
        const contributionEventsRef = collection(db, 'contributionEvents')
        const q = query(contributionEventsRef, where('campaignId', '==', campaignId))
        const querySnapshot = await getDocs(q)

        // Get unique contributors
        const uniqueContributors = new Set<string>()
        querySnapshot.forEach(doc => {
          const data = doc.data()
          if (data.contributor) {
            uniqueContributors.add(data.contributor.toLowerCase())
          }
        })

        // Convert to array and add avatar URLs
        const contributorsArray = Array.from(uniqueContributors).map(address => ({
          address,
          avatarUrl: generateAvatar(address)
        }))

        setContributors(contributorsArray)
      } catch (error) {
        console.error('Error fetching contributors:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContributors()
  }, [campaignId])

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      toast.success('Address copied!')
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy address')
    }
  }

  if (isLoading) {
    return <div className="animate-pulse">Loading contributors...</div>
  }

  if (contributors.length === 0) {
    return <div className="text-gray-500">No contributors yet</div>
  }

  return (
    <div className="flex flex-wrap gap-4 items-center justify-center">
      {contributors.map((contributor) => (
        <div 
          key={contributor.address}
          className="flex flex-col items-center space-y-2 group relative"
        >
          <div className="relative">
            <img
              src={contributor.avatarUrl}
              alt={`Contributor ${shortenAddress(contributor.address)}`}
              className="w-16 h-16 rounded-full border-2 border-gray-200"
            />
          </div>
          <span className="text-sm text-gray-600">
            {shortenAddress(contributor.address)}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white shadow-lg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Contributor Address</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-mono">{contributor.address}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCopy(contributor.address)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  title="Copy address"
                >
                  {copiedAddress === contributor.address ? (
                    <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  ) : (
                    <ClipboardIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              <a
                href={`https://basescan.org/address/${contributor.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
              >
                View on Basescan →
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
