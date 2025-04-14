import { useState, useEffect } from 'react'
import { db } from '../utils/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { useAccount } from 'wagmi'

export interface Campaign {
  id: string
  title: string
  description: string
  imageUrl?: string
  category?: string
  targetAmount: string
  totalRaised: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  createdAt: string
  contributors: number
  yieldGenerated: string
  currentAPY: number
  depositedAmount: string
  availableYield: string
  owner: string
  ownerAddress: string
  networkId: string
}

export function useCampaigns () {
  const { address } = useAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const campaignsRef = collection(db, 'campaigns')
        const q = query(campaignsRef, orderBy('createdAt', 'desc'))

        const querySnapshot = await getDocs(q)
        const fetchedCampaigns: Campaign[] = []

        querySnapshot.forEach(doc => {
          const data = doc.data()
          fetchedCampaigns.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            imageUrl: data.imageUrl,
            category: data.category,
            targetAmount: data.goalAmountSmallestUnits,
            totalRaised: data.totalContributions || '0',
            status: getStatusFromNumber(data.status),
            createdAt: data.createdAt,
            contributors: data.contributors || 0,
            yieldGenerated: data.yieldGenerated || '0',
            currentAPY: data.currentAPY || 0,
            depositedAmount: data.depositedAmount || '0',
            availableYield: data.availableYield || '0',
            owner: data.owner,
            ownerAddress: data.ownerAddress,
            networkId: data.networkId
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

    fetchCampaigns()
  }, [address])

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
    error
  }
}
