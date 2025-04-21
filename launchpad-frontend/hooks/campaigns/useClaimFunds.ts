import { useState } from 'react'
import { Contract, BrowserProvider } from 'ethers'
import { useWalletClient } from 'wagmi'
import CampaignABI from '../../../artifacts/contracts/Campaign.sol/Campaign.json'
import toast from 'react-hot-toast'

// Error codes from Campaign.sol
const CAMPAIGN_ERROR_CODES = {
  ERR_CAMPAIGN_STILL_ACTIVE: 4,
  ERR_ADMIN_OVERRIDE_ACTIVE: 7,
  ERR_FUNDS_CLAIMED: 8,
  ERR_NOTHING_TO_WITHDRAW: 10,
  ERR_INVALID_ADDRESS: 11
} as const

// Error codes from DefiIntegrationManager.sol
const DEFI_ERROR_CODES = {
  ERR_WITHDRAWAL_DOESNT_BALANCE: 1,
  ERR_WITHDRAWAL_FAILED: 2
} as const

export const useClaimFunds = () => {
  const [isClaiming, setIsClaiming] = useState(false)
  const { data: walletClient } = useWalletClient()

  const parseContractError = (error: any): string => {
    // Check if it's a contract revert error
    if (error.data) {
      // Try to parse the error data
      try {
        const errorData = error.data
        
        // Check if it's a CampaignError
        if (errorData.includes('CampaignError')) {
          // Extract the error code and parameters from the error data
          // The error data format is: CampaignError(uint8,address,uint256,uint256)
          const errorCode = parseInt(errorData.slice(10, 12), 16)
          const errorAddress = '0x' + errorData.slice(12, 52)
          const errorParam1 = parseInt(errorData.slice(52, 66), 16)
          const errorParam2 = parseInt(errorData.slice(66, 82), 16)
          
          switch (errorCode) {
            case CAMPAIGN_ERROR_CODES.ERR_CAMPAIGN_STILL_ACTIVE:
              return 'Campaign is still active and has not reached its goal'
            case CAMPAIGN_ERROR_CODES.ERR_ADMIN_OVERRIDE_ACTIVE:
              return 'Admin override is currently active'
            case CAMPAIGN_ERROR_CODES.ERR_FUNDS_CLAIMED:
              return 'Funds have already been claimed'
            case CAMPAIGN_ERROR_CODES.ERR_NOTHING_TO_WITHDRAW:
              return 'No funds available to withdraw'
            case CAMPAIGN_ERROR_CODES.ERR_INVALID_ADDRESS:
              return `Invalid token address: ${errorAddress}`
            default:
              return `Campaign error: ${errorCode}`
          }
        }
        
        // Check if it's a WithdrawFromYieldProtocolError
        if (errorData.includes('WithdrawFromYieldProtocolError')) {
          // Extract the error code from the custom error data
          const errorCode = parseInt(errorData.slice(10, 12), 16)
          
          switch (errorCode) {
            case DEFI_ERROR_CODES.ERR_WITHDRAWAL_DOESNT_BALANCE:
              return 'Withdrawal amount mismatch in yield protocol'
            case DEFI_ERROR_CODES.ERR_WITHDRAWAL_FAILED:
              return 'Failed to withdraw from yield protocol'
            default:
              return 'Failed to withdraw funds from yield protocol'
          }
        }

        // If we can't identify the error type
        console.error('Unknown contract error type:', errorData)
        return 'Failed to process transaction'
      } catch (parseError) {
        console.error('Error parsing contract error:', parseError)
        return 'Failed to claim funds'
      }
    }

    // Handle user rejection
    if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
      return 'Transaction was cancelled'
    }

    // Handle other errors
    return error.message || 'Failed to claim funds'
  }

  const claimFunds = async (campaignAddress: string) => {

    if (!walletClient || !campaignAddress) {
      toast.error('Please connect your wallet')
      return
    }

    setIsClaiming(true)
    const toastId = toast.loading('Claiming funds...')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      
      
      
      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CampaignABI.abi,
        signer
      )

      // Call claimFunds function
      const tx = await campaignContract.claimFunds()
      toast.loading('Waiting for confirmation...', { id: toastId })

      await tx.wait()

      toast.success('Funds claimed successfully!', { id: toastId })
      return tx.hash
    } catch (error: any) {
      console.log(error.data)
      // console.error('Error claiming funds:', error)
      const errorMessage = parseContractError(error)
      toast.error(errorMessage, { id: toastId })
      throw error
    } finally {
      setIsClaiming(false)
    }
  }

  return {
    claimFunds,
    isClaiming
  }
}
