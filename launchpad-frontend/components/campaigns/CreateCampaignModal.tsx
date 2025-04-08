import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import TokenSelector from '../TokenSelector'

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

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement campaign creation logic
    console.log({ title, description, targetAmount, selectedToken })
    onClose()
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center'>
      <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-2xl font-bold'>Create New Campaign</h2>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700'
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
              />
              <TokenSelector
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
                className='rounded-r-md'
              />
            </div>
          </div>

          <div className='flex justify-end space-x-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              className='px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700'
            >
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
