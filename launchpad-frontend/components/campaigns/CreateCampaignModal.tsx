import { useState, useRef, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { useCampaignFactory } from '../../hooks/useCampaignFactory'
import { useTokenRegistry } from '../../hooks/tokenRegistry'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useHydration } from '../../pages/_app'

interface Token {
  address: string
  symbol: string
  decimals: number
  isSupported: boolean
  minimumContribution: string
}

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const categories = [
  'DeFi',
  'Infrastructure',
  'DAOs',
  'NFTs',
  'Gaming',
  'Identity',
  'RWA',
  'Public Goods',
  'Climate',
  'Enterprise'
]

export default function CreateCampaignModal({
  isOpen,
  onClose,
  onSuccess
}: CreateCampaignModalProps) {
  const { isHydrated } = useHydration()
  const { address, isConnected } = useAccount()
  const { createCampaign } = useCampaignFactory()
  const { tokens, isLoading: isLoadingTokens } = useTokenRegistry()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState('')
  const [duration, setDuration] = useState('')
  const [category, setCategory] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelButtonRef = useRef(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Use useEffect only for form reset
  useEffect(() => {
    // Skip if not hydrated yet
    if (!isHydrated) return
    
    // Reset form when modal is opened
    if (isOpen) {
      setTitle('')
      setDescription('')
      setTargetAmount('')
      setSelectedToken('')
      setDuration('')
      setCategory('')
      setGithubUrl('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [isOpen, isHydrated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isHydrated) return

    // Direct state updates instead of requestAnimationFrame
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
      !category ||
      !githubUrl
    ) {
      setError('Please fill in all required fields')
      return
    }

    // Basic GitHub URL validation
    const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/
    if (!githubUrlPattern.test(githubUrl)) {
      setError('Please enter a valid GitHub repository URL')
      return
    }

    const toastId = toast.loading('Creating your campaign...')
    setIsSubmitting(true)

    try {
      toast.loading('Deploying campaign contract...', { id: toastId })
      await createCampaign(
        title,
        description,
        targetAmount,
        selectedToken,
        duration,
        category,
        githubUrl
      )

      toast.success('Campaign created successfully!', { id: toastId })
      onClose()
      if (onSuccess) {
        onSuccess()
      }
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
    if (formRef.current && isHydrated) {
      formRef.current.requestSubmit()
    }
  }

  // Skip rendering if not hydrated
  if (!isHydrated) {
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
        <Dialog.Panel className='mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-xl flex flex-col max-h-[90vh] border border-gray-100'>
          <Dialog.Title className='text-lg font-medium text-blue-600 p-6 border-b bg-gray-50 rounded-t-xl'>
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
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

            <div>
              <label
                htmlFor='githubUrl'
                className='block text-sm font-medium text-gray-900 mb-1.5'
              >
                GitHub Repository URL
              </label>
              <input
                type='url'
                id='githubUrl'
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder='https://github.com/username/repository'
                className='w-full pl-4 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400 transition-all'
                required
                pattern='https://github.com/[\w-]+/[\w.-]+/?'
              />
              <p className='mt-1 text-sm text-gray-500'>
                Please provide the URL to your project's GitHub repository
              </p>
            </div>
          </form>

          <div className='flex justify-end space-x-3 p-6 border-t bg-blue-50 rounded-b-xl'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 border border-gray-300 rounded-md transition-colors duration-200'
              ref={cancelButtonRef}
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleCreateClick}
              disabled={isSubmitting}
              className='inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
