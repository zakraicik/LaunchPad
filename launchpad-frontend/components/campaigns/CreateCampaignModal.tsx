import { useState, useRef, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { useCampaignFactory } from '../../hooks/useCampaignFactory'
import { useTokens } from '../../hooks/useTokens'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'
import { PlusIcon } from '@heroicons/react/24/outline'

interface Token {
  address: string
  symbol: string
}

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onCampaignCreated?: () => void
}

const categories = [
  'Medical',
  'Memorial',
  'Emergency',
  'Nonprofit',
  'Education',
  'Animal',
  'Environment',
  'Business',
  'Community',
  'Competition',
  'Creative',
  'Event',
  'Faith',
  'Family',
  'Sports',
  'Travel',
  'Volunteer',
  'Wishes'
]

export default function CreateCampaignModal ({
  isOpen,
  onClose,
  onCampaignCreated
}: CreateCampaignModalProps) {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const { createCampaign } = useCampaignFactory()
  const { tokens, isLoading: isLoadingTokens } = useTokens()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState('')
  const [duration, setDuration] = useState('')
  const [category, setCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelButtonRef = useRef(null)

  const formRef = useRef<HTMLFormElement>(null)

  // Handle hydration
  useEffect(() => {
    setMounted(true)
    return () => {
      setMounted(false)
    }
  }, [])

  // Reset form when modal is opened
  useEffect(() => {
    if (isOpen && mounted) {
      setTitle('')
      setDescription('')
      setTargetAmount('')
      setSelectedToken('')
      setDuration('')
      setCategory('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [isOpen, mounted])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mounted) return

    setError(null)

    if (!isConnected) {
      setError('Please connect your wallet')
      return
    }

    if (
      !title ||
      !description ||
      !targetAmount ||
      !selectedToken ||
      !duration ||
      !category
    ) {
      setError('Please fill in all required fields')
      return
    }

    const toastId = toast.loading('Creating your campaign...')
    setIsSubmitting(true)

    try {
      toast.loading('Deploying campaign contract...', { id: toastId })
      const campaignId = await createCampaign(
        title,
        description,
        targetAmount,
        selectedToken,
        duration,
        category
      )

      toast.success('Campaign created successfully!', { id: toastId })
      onClose()
      onCampaignCreated?.()
    } catch (err) {
      console.error('Error creating campaign:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create campaign'
      setError(errorMessage)
      toast.error(errorMessage, { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateClick = () => {
    if (formRef.current && mounted) {
      formRef.current.requestSubmit()
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className='relative z-50'
      initialFocus={cancelButtonRef}
    >
      <div className='fixed inset-0 bg-black/30' aria-hidden='true' />

      <div className='fixed inset-0 flex items-center justify-center p-4'>
        <Dialog.Panel className='mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] border border-gray-100'>
          <Dialog.Title className='text-lg font-medium text-gray-900 p-6 border-b bg-gray-50 rounded-t-xl'>
            Create New Campaign
          </Dialog.Title>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className='flex-1 overflow-y-auto p-6 space-y-6'
          >
            {error && (
              <div className='bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100'>
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor='title'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Campaign Title
              </label>
              <input
                type='text'
                id='title'
                value={title}
                onChange={e => setTitle(e.target.value)}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
              />
            </div>

            <div>
              <label
                htmlFor='description'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Description
              </label>
              <textarea
                id='description'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
              />
            </div>

            <div>
              <label
                htmlFor='targetAmount'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Target Amount
              </label>
              <input
                type='number'
                id='targetAmount'
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
                min='0'
                step='0.000000000000000001'
              />
            </div>

            <div>
              <label
                htmlFor='token'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Token
              </label>
              <select
                id='token'
                value={selectedToken}
                onChange={e => setSelectedToken(e.target.value)}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
              >
                <option value=''>Select a token</option>
                {tokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol || token.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor='duration'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Duration (days)
              </label>
              <input
                type='number'
                id='duration'
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
                min='1'
              />
            </div>

            <div>
              <label
                htmlFor='category'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                Category
              </label>
              <select
                id='category'
                value={category}
                onChange={e => setCategory(e.target.value)}
                className='w-full rounded-md border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 text-sm px-3 py-2'
                required
              >
                <option value=''>Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className='flex justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 border border-gray-300 rounded-md transition-colors duration-200'
              ref={cancelButtonRef}
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleCreateClick}
              disabled={isSubmitting}
              className='inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
