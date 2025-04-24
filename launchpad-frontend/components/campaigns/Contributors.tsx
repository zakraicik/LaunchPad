import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { generateAvatar } from '../../utils/avatar'
import { shortenAddress, formatNumber } from '../../utils/format'
import { ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import toast from 'react-hot-toast'

interface ContributorsProps {
  campaignId: string
  tokenAddress: string
}

interface ContributionEvent {
  contributor: string
  amount: string
  blockNumber: number
  blockTimestamp: Date
  transactionHash: string
  avatarUrl: string
}

export default function Contributors({ campaignId, tokenAddress }: ContributorsProps) {
  const [contributionEvents, setContributionEvents] = useState<ContributionEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const { getTokenByAddress } = useTokens()
  const token = getTokenByAddress(tokenAddress)

  useEffect(() => {
    const fetchContributionEvents = async () => {
      if (!campaignId) return

      try {
        setIsLoading(true)
        const contributionEventsRef = collection(db, 'contributionEvents')
        const q = query(
          contributionEventsRef, 
          where('campaignId', '==', campaignId),
          orderBy('blockTimestamp', 'desc')
        )
        const querySnapshot = await getDocs(q)

        const events = querySnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            contributor: data.contributor.toLowerCase(),
            amount: data.amount,
            blockNumber: data.blockNumber,
            blockTimestamp: data.blockTimestamp.toDate(),
            transactionHash: data.transactionHash,
            avatarUrl: generateAvatar(data.contributor.toLowerCase())
          }
        })

        setContributionEvents(events)
      } catch (error) {
        console.error('Error fetching contribution events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchContributionEvents()
  }, [campaignId])

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAddress(text)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatAmount = (amount: string) => {
    if (!token) return '0'
    try {
      const formattedAmount = formatUnits(amount, token.decimals)
      return formatNumber(Number(formattedAmount))
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-gray-500">Loading contribution history...</div>
      </div>
    )
  }

  if (contributionEvents.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">No contributions yet</div>
      </div>
    )
  }

  return (
    <div className="flow-root px-4">
      <ul role="list" className="-mb-8">
        {contributionEvents.map((event, eventIdx) => (
          <li key={event.transactionHash}>
            <div className="relative pb-8">
              {eventIdx !== contributionEvents.length - 1 ? (
                <span
                  className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex items-start space-x-3">
                <div className="relative">
                  <img
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white"
                    src={event.avatarUrl}
                    alt={`Contributor ${shortenAddress(event.contributor)}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {shortenAddress(event.contributor)}
                      </span>
                      <button
                        onClick={() => handleCopy(event.contributor)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy address"
                      >
                        {copiedAddress === event.contributor ? (
                          <ClipboardDocumentCheckIcon className="h-4 w-4" />
                        ) : (
                          <ClipboardIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Contributed {formatAmount(event.amount)} {token?.symbol || 'tokens'} • {formatDistanceToNow(event.blockTimestamp, { addSuffix: true })}
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      <a
                        href={`https://basescan.org/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View transaction →
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 self-center">
                  <div className="text-sm text-gray-500">
                    Block #{event.blockNumber}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
