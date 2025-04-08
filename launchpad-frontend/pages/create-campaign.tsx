import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { CONTRACT_ADDRESSES } from '../config/blockchain'
import { ethers } from 'ethers'

// Factory contract ABI (only the deploy function)
const factoryAbi = [
  'function deploy(address _campaignToken, uint256 _campaignGoalAmount, uint32 _campaignDuration) external returns (address)'
]

export default function CreateCampaign () {
  const { address, isConnected } = useAccount()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    tokenAddress: '',
    goalAmount: '',
    durationInDays: '',
    campaignName: '',
    description: '',
    imageUrl: ''
  })

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected) {
      setError('Please connect your wallet first')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      // Request access to the user's wallet
      await window.ethereum.request({ method: 'eth_requestAccounts' })

      // Create a provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)

      // Get the signer (authenticated user)
      const signer = provider.getSigner()

      // Create factory contract instance
      const factory = new ethers.Contract(
        CONTRACT_ADDRESSES.CAMPAIGN_FACTORY,
        factoryAbi,
        signer
      )

      // Convert values to the right format
      const tokenAddr = formData.tokenAddress
      const goal = ethers.utils.parseUnits(formData.goalAmount, 18)
      const duration = parseInt(formData.durationInDays)

      // Call the deploy function
      const tx = await factory.deploy(tokenAddr, goal, duration)

      // Wait for transaction to be mined
      const receipt = await tx.wait()

      // Get the newly created campaign address from events
      const event = receipt.events.find(
        (event: any) => event.event === 'FactoryOperation'
      )
      const newCampaignAddress = event.args.campaignAddress

      setSuccess(
        `Campaign created successfully at address: ${newCampaignAddress}`
      )

      // TODO: Save campaign metadata to Firestore
      // const campaignMetadata = {
      //   address: newCampaignAddress,
      //   name: formData.campaignName,
      //   description: formData.description,
      //   imageUrl: formData.imageUrl,
      //   creator: address,
      //   createdAt: new Date().toISOString(),
      //   goalAmount: formData.goalAmount,
      //   durationInDays: formData.durationInDays,
      //   tokenAddress: formData.tokenAddress
      // };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-dark-950 p-8'>
      <div className='max-w-2xl mx-auto'>
        <h1 className='text-3xl font-display gradient-text mb-8'>
          Create New Campaign
        </h1>

        {!isConnected && (
          <div className='glass-card p-6 mb-6'>
            <p className='text-red-500'>
              Please connect your wallet to create a campaign
            </p>
          </div>
        )}

        <form onSubmit={createCampaign} className='space-y-6'>
          <div className='glass-card p-6'>
            <h2 className='text-xl text-neon-blue mb-4'>Campaign Details</h2>

            <div className='space-y-4'>
              <div>
                <label className='block text-gray-300 mb-2'>
                  Campaign Name
                </label>
                <input
                  type='text'
                  name='campaignName'
                  value={formData.campaignName}
                  onChange={handleInputChange}
                  className='input-field'
                  required
                />
              </div>

              <div>
                <label className='block text-gray-300 mb-2'>Description</label>
                <textarea
                  name='description'
                  value={formData.description}
                  onChange={handleInputChange}
                  className='input-field h-32'
                  required
                />
              </div>

              <div>
                <label className='block text-gray-300 mb-2'>Image URL</label>
                <input
                  type='url'
                  name='imageUrl'
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  className='input-field'
                />
              </div>
            </div>
          </div>

          <div className='glass-card p-6'>
            <h2 className='text-xl text-neon-blue mb-4'>Campaign Parameters</h2>

            <div className='space-y-4'>
              <div>
                <label className='block text-gray-300 mb-2'>
                  Token Address
                </label>
                <input
                  type='text'
                  name='tokenAddress'
                  value={formData.tokenAddress}
                  onChange={handleInputChange}
                  className='input-field'
                  required
                  placeholder='0x...'
                />
              </div>

              <div>
                <label className='block text-gray-300 mb-2'>Goal Amount</label>
                <input
                  type='number'
                  name='goalAmount'
                  value={formData.goalAmount}
                  onChange={handleInputChange}
                  className='input-field'
                  required
                  min='0'
                  step='0.000000000000000001'
                />
              </div>

              <div>
                <label className='block text-gray-300 mb-2'>
                  Duration (Days)
                </label>
                <input
                  type='number'
                  name='durationInDays'
                  value={formData.durationInDays}
                  onChange={handleInputChange}
                  className='input-field'
                  required
                  min='1'
                />
              </div>
            </div>
          </div>

          {error && (
            <div className='glass-card p-6 bg-red-500/10 border border-red-500'>
              <p className='text-red-500'>{error}</p>
            </div>
          )}

          {success && (
            <div className='glass-card p-6 bg-green-500/10 border border-green-500'>
              <p className='text-neon-green'>{success}</p>
            </div>
          )}

          <button
            type='submit'
            className='btn-primary w-full'
            disabled={!isConnected || loading}
          >
            {loading ? 'Creating Campaign...' : 'Create Campaign'}
          </button>
        </form>
      </div>
    </div>
  )
}
