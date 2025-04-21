import { useState, useEffect } from 'react'
import { db } from '../utils/firebase'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { useAccount } from 'wagmi'

export interface Campaign {
  id: string
  title: string
  description: string
  category?: string
  targetAmount: string
  totalRaised: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  createdAt: Timestamp
  contributors: number
  depositedAmount: string
  availableYield: string
  frontEndAuthID: string
  networkId: string
  goalAmountSmallestUnits: string
  token: string
  duration: number
  hasClaimed?: boolean
  canClaimFunds?: boolean
  statusText: string
  statusColor: string
}

interface UseCampaignsOptions {
  filterByOwner?: boolean
}

export function useCampaigns ({ filterByOwner = false }: UseCampaignsOptions = {}) {
  const { address } = useAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const campaignsRef = collection(db, 'campaigns')
      let q = query(campaignsRef, orderBy('createdAt', 'desc'))

      // Add owner filter if requested and address is available
      if (filterByOwner && address) {
        q = query(campaignsRef, where('creator', '==', address.toLowerCase()), orderBy('createdAt', 'desc'))
      }

      const querySnapshot = await getDocs(q)
      const fetchedCampaigns: Campaign[] = []

      querySnapshot.forEach(doc => {
        const data = doc.data()
        fetchedCampaigns.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          category: data.category,
          targetAmount: data.goalAmountSmallestUnits,
          totalRaised: data.totalContributions || '0',
          status: getStatusFromNumber(data.status),
          createdAt: data.createdAt,
          contributors: data.contributors || 0,
          depositedAmount: data.depositedAmount || '0',
          availableYield: data.availableYield || '0',
          frontEndAuthID: data.frontEndAuthID,
          networkId: data.networkId,
          goalAmountSmallestUnits: data.goalAmountSmallestUnits,
          token: data.token,
          duration: data.duration || '',
          hasClaimed: data.hasClaimed,
          canClaimFunds: data.canClaimFunds,
          statusText: data.statusText,
          statusColor: data.statusColor
        })
      })

      setCampaigns(fetchedCampaigns)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
      setError('Failed to fetch campaigns')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [address, filterByOwner])

  const getStatusFromNumber = (status: number): Campaign['status'] => {
    switch (status) {
      case 0:
        return 'draft'
      case 1:
        return 'active'
      case 2:
        return 'completed'
      case 3:
        return 'cancelled'
      default:
        return 'draft'
    }
  }

  return {
    campaigns,
    isLoading,
    error,
    refresh: fetchCampaigns
  }
}
