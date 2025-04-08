import { useCallback, useState } from 'react'
import { ethers } from 'ethers'
import { db } from '../utils/firebase'
import { doc, getDoc } from 'firebase/firestore'
import CampaignContractFactory from '../../artifacts/contracts/CampaignContractFactory.sol/CampaignContractFactory.json'
import { getContractAddress } from '../config/addresses'
import { useWalletClient } from 'wagmi'

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
      duration: string
    ) => {
      try {
        setIsLoading(true)
        setError(null)

        if (!walletClient) {
          throw new Error('Please connect your wallet')
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

        // Return the transaction hash
        return receipt.hash
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
