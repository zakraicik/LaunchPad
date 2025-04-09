import { useCallback, useState } from 'react'
import { ethers } from 'ethers'
import { db } from '../utils/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import CampaignContractFactory from '../../artifacts/contracts/CampaignContractFactory.sol/CampaignContractFactory.json'
import { getContractAddress } from '../config/addresses'
import { useWalletClient } from 'wagmi'
import { getAuth } from 'firebase/auth'

// Define the operation type constant
const OP_CAMPAIGN_CREATED = 1

export function useCampaignFactory () {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: walletClient } = useWalletClient()

  const createCampaign = useCallback(
    async (
      title: string,
      description: string,
      targetAmount: string,
      selectedToken: string,
      duration: string,
      imageUrl?: string
    ) => {
      try {
        setIsLoading(true)
        setError(null)

        if (!walletClient) {
          throw new Error('Please connect your wallet')
        }

        // Get the authenticated user
        const auth = getAuth()
        const user = auth.currentUser
        if (!user) {
          throw new Error('Please sign in with your wallet')
        }

        // Get token decimals from Firebase
        const tokenDoc = await getDoc(doc(db, 'tokens', selectedToken))
        if (!tokenDoc.exists()) {
          throw new Error('Token not found')
        }

        const tokenData = tokenDoc.data()
        const decimals = tokenData.decimals

        // Get the provider and signer from Wagmi
        const provider = new ethers.BrowserProvider(walletClient.transport)
        const network = await provider.getNetwork()
        console.log('Connected to network:', network.name, network.chainId)

        // Get the correct contract address for this network
        const factoryAddress = getContractAddress(
          Number(network.chainId),
          'campaignFactory'
        )

        const signer = await provider.getSigner()
        const ownerAddress = await signer.getAddress()

        // Create contract instance
        const factory = new ethers.Contract(
          factoryAddress,
          CampaignContractFactory.abi,
          signer
        )

        // Convert target amount to token decimals
        const targetAmountInWei = ethers.parseUnits(targetAmount, decimals)

        // Convert duration to number
        const durationInDays = parseInt(duration)

        // Call the deploy function
        const tx = await factory.deploy(
          selectedToken,
          targetAmountInWei,
          durationInDays
        )

        // Wait for transaction to be mined
        const receipt = await tx.wait()
        console.log('Transaction receipt:', receipt)

        // Get the event topic hash for FactoryOperation
        const factoryOperationEvent =
          factory.interface.getEvent('FactoryOperation')
        if (!factoryOperationEvent) {
          throw new Error('FactoryOperation event not found in ABI')
        }

        const factoryOperationTopic = factoryOperationEvent.topicHash
        console.log('FactoryOperation topic hash:', factoryOperationTopic)

        // Extract the campaign ID from the receipt
        // The campaign ID is emitted in the FactoryOperation event
        const factoryOperationEventLog = receipt.logs.find(
          (log: ethers.Log) => {
            console.log('Checking log:', {
              topics: log.topics,
              data: log.data
            })

            // First check if this is a FactoryOperation event
            if (log.topics[0] !== factoryOperationTopic) {
              return false
            }

            try {
              const decoded = factory.interface.decodeEventLog(
                'FactoryOperation',
                log.data,
                log.topics
              )
              console.log('Decoded event:', decoded)
              return decoded.opType === OP_CAMPAIGN_CREATED
            } catch (e) {
              console.error('Error decoding event:', e)
              return false
            }
          }
        )

        if (!factoryOperationEventLog) {
          console.error('No FactoryOperation event found in logs')
          throw new Error('Failed to extract campaign ID from transaction')
        }

        const decodedEvent = factory.interface.decodeEventLog(
          'FactoryOperation',
          factoryOperationEventLog.data,
          factoryOperationEventLog.topics
        )
        console.log('Final decoded event:', decodedEvent)

        const campaignId = decodedEvent.campaignId
        console.log('Extracted campaign ID:', campaignId)

        // Create or update the campaign document in Firebase
        const campaignRef = doc(db, 'campaigns', campaignId)
        const campaignData = {
          title,
          description,
          targetAmount: targetAmountInWei.toString(),
          tokenAddress: selectedToken,
          duration: durationInDays,
          owner: user.uid, // Use Firebase auth UID instead of wallet address
          ownerAddress, // Store wallet address for reference
          imageUrl: imageUrl || null,
          createdAt: new Date().toISOString(),
          status: 'active',
          raisedAmount: '0',
          contributors: [],
          networkId: network.chainId.toString()
        }

        // Use setDoc with merge: true to update if exists, create if not
        await setDoc(campaignRef, campaignData, { merge: true })

        return {
          txHash: receipt.hash,
          campaignId
        }
      } catch (err) {
        console.error('Error creating campaign:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to create campaign'
        )
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient]
  )

  return {
    createCampaign,
    isLoading,
    error
  }
}
