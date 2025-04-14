import { useState, useRef } from 'react'
import { Dialog } from '@headlessui/react'
import { useCampaignFactory } from '../../hooks/useCampaignFactory'
import { useTokens } from '../../hooks/useTokens'
import { useAccount } from 'wagmi'
import { formatEther } from 'ethers'
import { useDropzone } from 'react-dropzone'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../../utils/firebase'
import {
  doc,
  setDoc,
  DocumentData,
  Firestore,
  DocumentReference,
  collection
} from 'firebase/firestore'

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
  const { address } = useAccount()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!address) {
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

    setIsSubmitting(true)

    try {
      let imageUrl: string | undefined = undefined
      if (image) {
        const storage = getStorage()
        const storageRef = ref(storage, `campaigns/${Date.now()}-${image.name}`)
        await uploadBytes(storageRef, image)
        imageUrl = await getDownloadURL(storageRef)
      }

      const campaignId = await createCampaign(
        title,
        description,
        targetAmount,
        selectedToken,
        duration,
        imageUrl,
        category
      )

      // Create a document in the campaigns collection
      const campaignRef: DocumentReference<DocumentData> = doc(
        db as Firestore,
        'campaigns',
        campaignId.campaignId
      )
      const campaignData: DocumentData = {
        title,
        description,
        targetAmount,
        tokenAddress: selectedToken,
        duration,
        imageUrl,
        category,
        owner: address,
        status: 'active',
        totalRaised: '0',
        contributors: 0,
        createdAt: new Date().toISOString()
      }
      await setDoc(campaignRef, campaignData)

      onClose()
    } catch (err) {
      console.error('Error creating campaign:', err)
      setError('Failed to create campaign. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
        <Dialog.Panel className='mx-auto max-w-2xl w-full bg-white rounded-xl shadow-lg'>
          <Dialog.Title className='text-lg font-medium text-gray-900 p-6 border-b'>
            Create New Campaign
          </Dialog.Title>

          <form onSubmit={handleSubmit} className='p-6 space-y-6'>
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

            <div className='flex justify-end space-x-3 pt-4'>
              <button
                type='button'
                onClick={onClose}
                ref={cancelButtonRef}
                className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={isSubmitting}
                className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
              >
                {isSubmitting ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
