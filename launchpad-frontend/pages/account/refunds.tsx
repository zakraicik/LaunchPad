import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import { formatUnits } from 'ethers'
import { useTokens } from '../../hooks/useTokens'
import { formatNumber } from '../../utils/format'
import Link from 'next/link'
import { BanknotesIcon } from '@heroicons/react/24/outline'

interface Campaign {
  id: string
  title: string
  description: string
  goalAmountSmallestUnits: string
  token: string
  createdAt: any
  duration: string
  campaignAddress?: string
  hasClaimed?: boolean
  contribution?: string
  totalContributions?: string
}

export default function RefundsPage() {
  const { address, isConnected } = useAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { getTokenByAddress } = useTokens()

  useEffect(() => {
    const fetchRefundableCampaigns = async () => {
      if (!address) return

      setIsLoading(true)
      try {
        // First, get all contribution events for this user
        const contributionEventsRef = collection(db, 'contributionEvents')
        const contributionQuery = query(
          contributionEventsRef,
          where('contributor', '==', address.toLowerCase())
        )
        const contributionSnapshot = await getDocs(contributionQuery)

        // Get unique campaign IDs and contribution amounts
        const campaignContributions = new Map<string, string>()
        contributionSnapshot.forEach(doc => {
          const data = doc.data()
          const existingAmount = campaignContributions.get(data.campaignId) || '0'
          const newAmount = (BigInt(existingAmount) + BigInt(data.amount)).toString()
          campaignContributions.set(data.campaignId, newAmount)
        })

        // Get refund events to exclude already refunded campaigns
        const refundEventsRef = collection(db, 'refundEvents')
        const refundQuery = query(
          refundEventsRef,
          where('contributor', '==', address.toLowerCase())
        )
        const refundSnapshot = await getDocs(refundQuery)
        const refundedCampaignIds = new Set(
          refundSnapshot.docs.map(doc => doc.data().campaignId)
        )

        // Get campaign details for contributed campaigns
        const campaignsRef = collection(db, 'campaigns')
        const campaignsData: Campaign[] = []

        for (const [campaignId, contribution] of Array.from(campaignContributions.entries())) {
          if (!refundedCampaignIds.has(campaignId)) {
            const campaignDoc = await getDocs(
              query(campaignsRef, where('id', '==', campaignId))
            )
            
            if (!campaignDoc.empty) {
              const campaignData = campaignDoc.docs[0].data() as Campaign
              // Only include campaigns that have ended unsuccessfully and owner has claimed
              const endTime = new Date(
                (typeof campaignData.createdAt === 'string' 
                  ? new Date(campaignData.createdAt) 
                  : campaignData.createdAt.toDate()
                ).getTime() + parseInt(campaignData.duration) * 24 * 60 * 60 * 1000
              )
              
              if (
                new Date() > endTime && // Campaign has ended
                campaignData.hasClaimed && // Owner has claimed
                BigInt(campaignData.totalContributions || '0') < BigInt(campaignData.goalAmountSmallestUnits) // Campaign unsuccessful
              ) {
                campaignsData.push({
                  ...campaignData,
                  contribution
                })
              }
            }
          }
        }

        setCampaigns(campaignsData)
      } catch (error) {
        console.error('Error fetching refundable campaigns:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRefundableCampaigns()
  }, [address])

  const formatAmount = (amount: string, tokenAddress: string): string => {
    const token = getTokenByAddress(tokenAddress)
    if (!amount || !token) return '0.0'
    try {
      const rawAmount = formatUnits(amount, token.decimals)
      return formatNumber(Number(parseFloat(rawAmount).toFixed(1)))
    } catch (error) {
      console.error('Error formatting amount:', error)
      return '0.0'
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600">Please connect your wallet to view refundable campaigns.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600">Loading refundable campaigns...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-20">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Available Refunds</h1>
        
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-600">No refunds are currently available.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {campaigns.map(campaign => {
              const token = getTokenByAddress(campaign.token)
              return (
                <div key={campaign.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {campaign.title}
                      </h2>
                      <p className="text-sm text-gray-500 mb-4">
                        Your contribution: {formatAmount(campaign.contribution || '0', campaign.token)} {token?.symbol}
                      </p>
                    </div>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 transition-colors"
                    >
                      <BanknotesIcon className="h-4 w-4 mr-2" />
                      Request Refund
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
} 