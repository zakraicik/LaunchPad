import { useState, useEffect, useCallback } from 'react'
import { db } from '../utils/firebase'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { useAccount, useChainId } from 'wagmi'
import { SUPPORTED_NETWORKS } from '../config/addresses'

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
  networkId: number
  goalAmountSmallestUnits: string
  token: string
  duration: number
  githubUrl?: string
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
  const chainId = useChainId()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    console.log('Starting fetchCampaigns', { chainId, address, filterByOwner })
    try {
      setIsLoading(true)
      setError(null)

      // Ensure chainId is one of our supported networks
      if (!SUPPORTED_NETWORKS.includes(chainId as typeof SUPPORTED_NETWORKS[number])) {
        console.log('Unsupported network, clearing campaigns')
        setCampaigns([])
        setIsLoading(false)
        return
      }

      const campaignsRef = collection(db, 'campaigns')
      let q = query(campaignsRef, orderBy('createdAt', 'desc'))

      q = query(q, where('networkId', '==', chainId.toString()))

      if (filterByOwner && address) {
        q = query(q, where('creator', '==', address.toLowerCase()))
      }

      console.log('Executing Firestore query')
      const querySnapshot = await getDocs(q)
      console.log('Query completed, processing results')
      
      const fetchedCampaigns: Campaign[] = []

      querySnapshot.forEach(doc => {
        const data = doc.data()
        try {
          // Convert stored networkId to number for internal use
          const networkId = parseInt(data.networkId, 10)

          if (networkId === chainId) {
            fetchedCampaigns.push({
              id: doc.id,
              title: data.title || '',
              description: data.description || '',
              category: data.category,
              targetAmount: data.goalAmountSmallestUnits || '0',
              totalRaised: data.totalContributions || '0',
              status: getStatusFromNumber(data.status),
              createdAt: data.createdAt,
              contributors: data.contributors || 0,
              depositedAmount: data.depositedAmount || '0',
              availableYield: data.availableYield || '0',
              frontEndAuthID: data.frontEndAuthID || '',
              networkId: networkId,
              goalAmountSmallestUnits: data.goalAmountSmallestUnits || '0',
              token: data.token || '0x0000000000000000000000000000000000000000',
              duration: data.duration || 0,
              githubUrl: data.githubUrl,
              hasClaimed: data.hasClaimed || false,
              canClaimFunds: data.canClaimFunds || false,
              statusText: data.statusText || '',
              statusColor: data.statusColor || ''
            })
          }
        } catch (err) {
          console.error('Error processing campaign:', err)
        }
      })

      console.log('Setting campaigns:', fetchedCampaigns.length)
      setCampaigns(fetchedCampaigns)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
      setError('Failed to fetch campaigns')
    } finally {
      console.log('Setting isLoading to false')
      setIsLoading(false)
    }
  }, [address, chainId, filterByOwner])

  useEffect(() => {
    console.log('useEffect triggered', { chainId, address, filterByOwner })
    let mounted = true

    if (mounted) {
      fetchCampaigns()
    }

    return () => {
      mounted = false
    }
  }, [fetchCampaigns])

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
