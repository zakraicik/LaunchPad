import { useCallback, useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { db } from '../utils/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import CampaignContractFactory from '../../artifacts/contracts/CampaignContractFactory.sol/CampaignContractFactory.json'
import { getContractAddress } from '../config/addresses'
import { useWalletClient, useAccount } from 'wagmi'
import { getAuth } from 'firebase/auth'

// Define the operation type constant
const OP_CAMPAIGN_CREATED = 1

export function useCampaignFactory () {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: walletClient } = useWalletClient()
  const { address, isConnected } = useAccount()

  // Initialize state in useEffect to avoid render-phase updates
  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [error])

  const createCampaign = useCallback(
    async (
      title: string,
      description: string,
      targetAmount: string,
      selectedToken: string,
      duration: string,
      category?: string
    ) => {
      try {
        console.log('useCampaignFactory: Starting campaign creation', {
          isConnected,
          hasWalletClient: !!walletClient,
          address
        })

        setIsLoading(true)
        setError(null)

        if (!isConnected || !walletClient) {
          console.log('useCampaignFactory: Wallet not connected')
          throw new Error('Please connect your wallet')
        }

        // Get the authenticated user
        const auth = getAuth()
        const user = auth.currentUser
        console.log('useCampaignFactory: Firebase auth state', {
          isAuthenticated: !!user,
          user: user
            ? {
                uid: user.uid,
                email: user.email,
                isAnonymous: user.isAnonymous
              }
            : null
        })

        if (!user) {
          console.log('useCampaignFactory: No Firebase user found')
          throw new Error('Please sign in with your wallet')
        }

        // Get the provider and signer from Wagmi
        const provider = new ethers.BrowserProvider(walletClient.transport)
        const network = await provider.getNetwork()
        console.log('useCampaignFactory: Connected to network:', {
          name: network.name,
          chainId: network.chainId
        })

        // Get the correct contract address for this network
        const factoryAddress = getContractAddress(
          Number(network.chainId),
          'campaignFactory'
        )
        console.log(
          'useCampaignFactory: Using factory address:',
          factoryAddress
        )

        const signer = await provider.getSigner()
        const ownerAddress = await signer.getAddress()
        console.log('useCampaignFactory: Owner address:', ownerAddress)

        // Get token decimals from Firebase
        const tokenDoc = await getDoc(doc(db, 'tokens', selectedToken))
        if (!tokenDoc.exists()) {
          console.log('useCampaignFactory: Token not found:', selectedToken)
          throw new Error('Token not found')
        }

        const tokenData = tokenDoc.data()
        const decimals = tokenData.decimals
        console.log('useCampaignFactory: Token decimals:', decimals)

        // Create contract instance
        const factory = new ethers.Contract(
          factoryAddress,
          CampaignContractFactory.abi,
          signer
        )

        // Convert target amount to token decimals
        const targetAmountInWei = ethers.parseUnits(targetAmount, decimals)
        console.log(
          'useCampaignFactory: Target amount in wei:',
          targetAmountInWei.toString()
        )

        // Convert duration to number
        const durationInDays = parseInt(duration)
        console.log('useCampaignFactory: Duration in days:', durationInDays)

        // Call the deploy function
        console.log('useCampaignFactory: Deploying campaign contract')
        const tx = await factory.deploy(
          selectedToken,
          targetAmountInWei,
          durationInDays
        )

        // Wait for transaction to be mined
        console.log('useCampaignFactory: Waiting for transaction')
        const receipt = await tx.wait()
        console.log('useCampaignFactory: Transaction receipt:', receipt)

        // Get the event topic hash for FactoryOperation
        const factoryOperationEvent =
          factory.interface.getEvent('FactoryOperation')
        if (!factoryOperationEvent) {
          console.log(
            'useCampaignFactory: FactoryOperation event not found in ABI'
          )
          throw new Error('FactoryOperation event not found in ABI')
        }

        const factoryOperationTopic = factoryOperationEvent.topicHash
        console.log(
          'useCampaignFactory: FactoryOperation topic hash:',
          factoryOperationTopic
        )

        // Extract the campaign ID from the receipt
        const factoryOperationEventLog = receipt.logs.find(
          (log: ethers.Log) => {
            console.log('useCampaignFactory: Checking log:', {
              topics: log.topics,
              data: log.data
            })

            if (log.topics[0] !== factoryOperationTopic) {
              return false
            }

            try {
              const decoded = factory.interface.decodeEventLog(
                'FactoryOperation',
                log.data,
                log.topics
              )
              console.log('useCampaignFactory: Decoded event:', decoded)
              return decoded[0] === BigInt(OP_CAMPAIGN_CREATED)
            } catch (e) {
              console.error('useCampaignFactory: Error decoding event:', e)
              return false
            }
          }
        )

        if (!factoryOperationEventLog) {
          console.log(
            'useCampaignFactory: No FactoryOperation event found in logs'
          )
          throw new Error('Failed to extract campaign ID from transaction')
        }

        const decodedEvent = factory.interface.decodeEventLog(
          'FactoryOperation',
          factoryOperationEventLog.data,
          factoryOperationEventLog.topics
        )
        console.log('useCampaignFactory: Final decoded event:', decodedEvent)

        const campaignId = decodedEvent[3]
        const campaignAddress = decodedEvent[1].toLowerCase()
        console.log('useCampaignFactory: Extracted campaign ID:', campaignId)
        console.log('useCampaignFactory: Extracted campaign address:', campaignAddress)

        // Create or update the campaign document in Firebase
        const campaignRef = doc(db, 'campaigns', campaignId)
        const campaignData = {
          title,
          description,
          goalAmountSmallestUnits: targetAmountInWei.toString(),
          token: selectedToken,
          duration: durationInDays,
          frontEndAuthID: user.uid,
          category: category || null,
          networkId: network.chainId.toString()
        }

        console.log('useCampaignFactory: Saving campaign data to Firebase')
        await setDoc(campaignRef, campaignData, { merge: true })
        console.log('useCampaignFactory: Campaign data saved successfully')

        return {
          txHash: receipt.hash,
          campaignId
        }
      } catch (err) {
        console.error('useCampaignFactory: Error creating campaign:', err)
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create campaign'
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, isConnected]
  )

  return {
    createCampaign,
    isLoading,
    error
  }
}
