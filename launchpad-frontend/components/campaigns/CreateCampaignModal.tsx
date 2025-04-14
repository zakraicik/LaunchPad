import { useState, useRef, useEffect } from 'react'
import { Dialog } from '@headlessui/react'
import { useCampaignFactory } from '../../hooks/useCampaignFactory'
import { useTokens } from '../../hooks/useTokens'
import { useAccount } from 'wagmi'
import { useDropzone } from 'react-dropzone'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import toast from 'react-hot-toast'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
}

const categories = [
  'Environment',
  'Education',
  'Healthcare',
  'Technology',
  'Infrastructure',
  'Science & Research'
]

export default function CreateCampaignModal ({
  isOpen,
  onClose
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
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelButtonRef = useRef(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setImage(acceptedFiles[0])
        setImagePreview(URL.createObjectURL(acceptedFiles[0]))
      }
    }
  })

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
      setImage(null)
      setImagePreview(null)
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
      let imageUrl: string | undefined = undefined
      if (image) {
        toast.loading('Uploading image...', { id: toastId })
        const storage = getStorage()
        const storageRef = ref(storage, `campaigns/${Date.now()}-${image.name}`)
        await uploadBytes(storageRef, image)
        imageUrl = await getDownloadURL(storageRef)
      }

      toast.loading('Deploying campaign contract...', { id: toastId })
      const campaignId = await createCampaign(
        title,
        description,
        targetAmount,
        selectedToken,
        duration,
        imageUrl,
        category
      )

      toast.success('Campaign created successfully!', { id: toastId })
      onClose()
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
        <Dialog.Panel className='mx-auto max-w-2xl w-full bg-white rounded-xl shadow-lg flex flex-col max-h-[90vh]'>
          <Dialog.Title className='text-lg font-medium text-gray-900 p-6 border-b bg-white rounded-t-xl'>
            Create New Campaign
          </Dialog.Title>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className='flex-1 overflow-y-auto p-6 space-y-6'
          >
            {error && (
              <div className='bg-red-50 text-red-600 p-3 rounded-md text-sm'>
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor='title'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Campaign Title
              </label>
              <input
                type='text'
                id='title'
                value={title}
                onChange={e => setTitle(e.target.value)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                required
              />
            </div>

            <div>
              <label
                htmlFor='description'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Description
              </label>
              <textarea
                id='description'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                required
              />
            </div>

            <div>
              <label
                htmlFor='category'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Category
              </label>
              <select
                id='category'
                value={category}
                onChange={e => setCategory(e.target.value)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
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

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label
                  htmlFor='targetAmount'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Target Amount
                </label>
                <input
                  type='number'
                  id='targetAmount'
                  value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                  required
                  min='0'
                  step='0.000000000000000001'
                />
              </div>

              <div>
                <label
                  htmlFor='token'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Token
                </label>
                <select
                  id='token'
                  value={selectedToken}
                  onChange={e => setSelectedToken(e.target.value)}
                  className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
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
            </div>

            <div>
              <label
                htmlFor='duration'
                className='block text-sm font-medium text-gray-700 mb-1'
              >
                Duration (days)
              </label>
              <input
                type='number'
                id='duration'
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                required
                min='1'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Campaign Image
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                {imagePreview ? (
                  <div className='space-y-2'>
                    <img
                      src={imagePreview}
                      alt='Preview'
                      className='mx-auto h-32 object-cover rounded-md'
                    />
                    <p className='text-sm text-gray-500'>
                      Click or drag to replace image
                    </p>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    <p className='text-sm text-gray-500'>
                      Drag and drop an image here, or click to select
                    </p>
                    <p className='text-xs text-gray-400'>
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>

          <div className='flex justify-end space-x-3 p-6 border-t bg-white rounded-b-xl'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 border border-gray-300 rounded-md'
              ref={cancelButtonRef}
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleCreateClick}
              disabled={isSubmitting}
              className='inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
