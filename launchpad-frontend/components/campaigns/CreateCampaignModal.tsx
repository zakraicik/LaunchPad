import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import TokenSelector from '../TokenSelector'
import { useCampaignFactory } from '../../hooks/useCampaignFactory'
import { toast } from 'react-hot-toast'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../../utils/firebase'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateCampaignModal ({
  isOpen,
  onClose
}: CreateCampaignModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState('')
  const [duration, setDuration] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const { createCampaign, isLoading, error } = useCampaignFactory()

  if (!isOpen) return null

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const storage = getStorage()
    const storageRef = ref(storage, `campaigns/${Date.now()}_${file.name}`)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedToken) {
      toast.error('Please select a token')
      return
    }

    const toastId = toast.loading('Creating campaign...')

    try {
      let imageUrl: string | undefined
      if (imageFile) {
        toast.loading('Uploading image...', { id: toastId })
        imageUrl = await uploadImage(imageFile)
      }

      toast.loading('Creating campaign...', { id: toastId })
      const result = await createCampaign(
        title,
        description,
        targetAmount,
        selectedToken,
        duration,
        imageUrl
      )

      toast.success('Campaign created successfully!', {
        id: toastId
      })
      console.log('Transaction hash:', result.txHash)
      console.log('Campaign ID:', result.campaignId)
      onClose()
    } catch (err) {
      console.error('Error creating campaign:', err)
      toast.error(error || 'Failed to create campaign', {
        id: toastId
      })
    }
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center'>
      <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-2xl font-bold'>Create New Campaign</h2>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700'
            disabled={isLoading}
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='title'
              className='block text-sm font-medium text-gray-700'
            >
              Campaign Title
            </label>
            <input
              type='text'
              id='title'
              value={title}
              onChange={e => setTitle(e.target.value)}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor='description'
              className='block text-sm font-medium text-gray-700'
            >
              Description
            </label>
            <textarea
              id='description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor='targetAmount'
              className='block text-sm font-medium text-gray-700'
            >
              Target Amount
            </label>
            <div className='mt-1 flex rounded-md shadow-sm'>
              <input
                type='number'
                id='targetAmount'
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                className='block w-full rounded-l-md border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                required
                disabled={isLoading}
              />
              <TokenSelector
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
                className='rounded-r-md'
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='duration'
              className='block text-sm font-medium text-gray-700'
            >
              Campaign Duration (days)
            </label>
            <input
              type='number'
              id='duration'
              value={duration}
              onChange={e => setDuration(e.target.value)}
              min='1'
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor='image'
              className='block text-sm font-medium text-gray-700'
            >
              Campaign Image
            </label>
            <div className='mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md'>
              <div className='space-y-1 text-center'>
                {imagePreview ? (
                  <div className='relative'>
                    <img
                      src={imagePreview}
                      alt='Preview'
                      className='max-h-48 mx-auto rounded-md'
                    />
                    <button
                      type='button'
                      onClick={() => setImagePreview(null)}
                      className='absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full'
                      disabled={isLoading}
                    >
                      <XMarkIcon className='h-4 w-4' />
                    </button>
                  </div>
                ) : (
                  <>
                    <svg
                      className='mx-auto h-12 w-12 text-gray-400'
                      stroke='currentColor'
                      fill='none'
                      viewBox='0 0 48 48'
                      aria-hidden='true'
                    >
                      <path
                        d='M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02'
                        strokeWidth={2}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                    <div className='flex text-sm text-gray-600'>
                      <label
                        htmlFor='image-upload'
                        className='relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500'
                      >
                        <span>Upload an image</span>
                        <input
                          id='image-upload'
                          name='image-upload'
                          type='file'
                          className='sr-only'
                          accept='image/*'
                          onChange={handleImageChange}
                          disabled={isLoading}
                        />
                      </label>
                      <p className='pl-1'>or drag and drop</p>
                    </div>
                    <p className='text-xs text-gray-500'>
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className='flex justify-end space-x-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50'
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
