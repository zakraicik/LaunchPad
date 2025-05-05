import { useQuery } from '@tanstack/react-query'
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { Timestamp } from 'firebase/firestore'
import { useHydration } from '../../pages/_app'

export interface ContributionEvent {
  campaignId: string
  contributor: string
  amount: string
  blockNumber: number
  blockTimestamp: Date
  transactionHash: string
  tokenAddress: string
}

export interface Campaign {
  id: string
  title: string
  description: string
  status: number
  statusText: string
  token: string
  campaignAddress?: string
  createdAt: string | Date | Timestamp
  duration: string
  totalContributions?: string
  goalAmountSmallestUnits?: string
}

export const useContributions = (address?: string) => {
  const { isHydrated } = useHydration()
  
  return useQuery({
    queryKey: ['contributions', address],
    queryFn: async () => {
      if (!address) return { contributionEvents: [], campaigns: {} }

      try {
        // Fetch contribution events
        const contributionEventsRef = collection(db, 'contributionEvents')
        const q = query(
          contributionEventsRef,
          where('contributor', '==', address.toLowerCase()),
          orderBy('blockTimestamp', 'desc')
        )
        const querySnapshot = await getDocs(q)

        const events = querySnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            campaignId: data.campaignId,
            contributor: data.contributor,
            amount: data.amount,
            blockNumber: data.blockNumber,
            blockTimestamp: data.blockTimestamp.toDate(),
            transactionHash: data.transactionHash,
            tokenAddress: data.token
          }
        })

        // Fetch campaign details for each contribution
        const campaignPromises = events.map(async (event) => {
          const campaignRef = doc(db, 'campaigns', event.campaignId)
          const campaignSnap = await getDoc(campaignRef)
          if (campaignSnap.exists()) {
            const data = campaignSnap.data()
            return {
              id: campaignSnap.id,
              ...data,
              token: data.token
            } as Campaign
          }
          return null
        })

        const campaignResults = await Promise.all(campaignPromises)
        const campaignMap = campaignResults.reduce((acc, campaign) => {
          if (campaign) {
            acc[campaign.id] = campaign
          }
          return acc
        }, {} as Record<string, Campaign>)

        return {
          contributionEvents: events,
          campaigns: campaignMap
        }
      } catch (error) {
        console.error('Error fetching contributions:', error)
        throw error
      }
    },
    // Only enable query when both address is available AND component is hydrated
    enabled: !!address && isHydrated,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000
  })
} 