import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { useAccount } from 'wagmi'
import { useTokenRegistry } from '../../hooks/useTokenRegistry'
import { type Address, zeroAddress } from 'viem'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CampaignFormData) => Promise<void>
}

export interface CampaignFormData {
  campaignToken: Address
  campaignGoalAmount: number
  campaignDuration: number
  name: string
  description: string
  imageUrl?: string
  status: 'draft' | 'active'
}

interface ValidationErrors {
  [key: string]: string
}

export default function CreateCampaignModal ({
  isOpen,
  onClose,
  onSubmit
}: CreateCampaignModalProps) {
  const { address } = useAccount()
  const { supportedTokens, getMinContribution } = useTokenRegistry()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formData, setFormData] = useState<CampaignFormData>({
    campaignToken: zeroAddress,
    campaignGoalAmount: 0,
    campaignDuration: 30,
    name: '',
    description: '',
    imageUrl: '',
    status: 'draft'
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const validateForm = async (): Promise<boolean> => {
    const newErrors: ValidationErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Campaign description is required'
    }

    if (formData.campaignToken === zeroAddress) {
      newErrors.campaignToken = 'Please select a token'
    }

    if (formData.campaignGoalAmount <= 0) {
      newErrors.campaignGoalAmount = 'Goal amount must be greater than 0'
    } else if (formData.campaignToken !== zeroAddress) {
      // Check minimum contribution amount
      const minContribution = await getMinContribution(formData.campaignToken)
      if (formData.campaignGoalAmount < minContribution) {
        newErrors.campaignGoalAmount = `Minimum goal amount is ${minContribution}`
      }
    }

    if (formData.campaignDuration < 1) {
      newErrors.campaignDuration = 'Duration must be at least 1 day'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const isValid = await validateForm()
      if (!isValid) {
        setIsSubmitting(false)
        return
      }

      await onSubmit(formData)
      onClose()
    } catch (error) {
      console.error('Error creating campaign:', error)
      setErrors({
        submit: 'Failed to create campaign. Please try again.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as='div' className='relative z-50' onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter='ease-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity' />
        </Transition.Child>

        <div className='fixed inset-0 z-10 overflow-y-auto'>
          <div className='flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
              enterTo='opacity-100 translate-y-0 sm:scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 translate-y-0 sm:scale-100'
              leaveTo='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
            >
              <Dialog.Panel className='relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6'>
                <div className='absolute right-0 top-0 pr-4 pt-4'>
                  <button
                    type='button'
                    className='rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    onClick={onClose}
                  >
                    <span className='sr-only'>Close</span>
                    <XMarkIcon className='h-6 w-6' aria-hidden='true' />
                  </button>
                </div>
                <div className='sm:flex sm:items-start'>
                  <div className='mt-3 text-center sm:mt-0 sm:text-left w-full'>
                    <Dialog.Title
                      as='h3'
                      className='text-base font-semibold leading-6 text-gray-900'
                    >
                      Create New Campaign
                    </Dialog.Title>
                    <form onSubmit={handleSubmit} className='mt-6 space-y-6'>
                      {/* Campaign Name */}
                      <div>
                        <label
                          htmlFor='name'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Name
                        </label>
                        <div className='mt-1'>
                          <input
                            type='text'
                            name='name'
                            id='name'
                            required
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='Enter campaign name'
                            value={formData.name}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                name: e.target.value
                              })
                            }
                          />
                        </div>
                        {errors.name && (
                          <p className='mt-1 text-sm text-red-600'>
                            {errors.name}
                          </p>
                        )}
                      </div>

                      {/* Campaign Description */}
                      <div>
                        <label
                          htmlFor='description'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Description
                        </label>
                        <div className='mt-1'>
                          <textarea
                            name='description'
                            id='description'
                            rows={3}
                            required
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='Describe your campaign'
                            value={formData.description}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                description: e.target.value
                              })
                            }
                          />
                        </div>
                        {errors.description && (
                          <p className='mt-1 text-sm text-red-600'>
                            {errors.description}
                          </p>
                        )}
                      </div>

                      {/* Campaign Token */}
                      <div>
                        <label
                          htmlFor='campaignToken'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Token
                        </label>
                        <div className='mt-1'>
                          <select
                            name='campaignToken'
                            id='campaignToken'
                            required
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            value={formData.campaignToken}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                campaignToken: e.target.value as Address
                              })
                            }
                          >
                            <option value={zeroAddress}>Select a token</option>
                            {supportedTokens.map(token => (
                              <option key={token.address} value={token.address}>
                                {token.symbol} - {token.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {errors.campaignToken && (
                          <p className='mt-1 text-sm text-red-600'>
                            {errors.campaignToken}
                          </p>
                        )}
                      </div>

                      {/* Campaign Goal Amount */}
                      <div>
                        <label
                          htmlFor='campaignGoalAmount'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Goal Amount
                        </label>
                        <div className='mt-1'>
                          <input
                            type='number'
                            name='campaignGoalAmount'
                            id='campaignGoalAmount'
                            required
                            min='0'
                            step='0.000001'
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='0.00'
                            value={formData.campaignGoalAmount}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                campaignGoalAmount: parseFloat(e.target.value)
                              })
                            }
                          />
                        </div>
                        {errors.campaignGoalAmount && (
                          <p className='mt-1 text-sm text-red-600'>
                            {errors.campaignGoalAmount}
                          </p>
                        )}
                      </div>

                      {/* Campaign Duration */}
                      <div>
                        <label
                          htmlFor='campaignDuration'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Duration (days)
                        </label>
                        <div className='mt-1'>
                          <input
                            type='number'
                            name='campaignDuration'
                            id='campaignDuration'
                            required
                            min='1'
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='30'
                            value={formData.campaignDuration}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                campaignDuration: parseInt(e.target.value)
                              })
                            }
                          />
                        </div>
                        {errors.campaignDuration && (
                          <p className='mt-1 text-sm text-red-600'>
                            {errors.campaignDuration}
                          </p>
                        )}
                      </div>

                      {/* Campaign Image */}
                      <div>
                        <label
                          htmlFor='imageUrl'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Image URL
                        </label>
                        <div className='mt-1'>
                          <input
                            type='url'
                            name='imageUrl'
                            id='imageUrl'
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='https://example.com/image.jpg'
                            value={formData.imageUrl}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                imageUrl: e.target.value
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Campaign Status */}
                      <div>
                        <label
                          htmlFor='status'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Status
                        </label>
                        <div className='mt-1'>
                          <select
                            name='status'
                            id='status'
                            required
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            value={formData.status}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                status: e.target.value as 'draft' | 'active'
                              })
                            }
                          >
                            <option value='draft'>Draft</option>
                            <option value='active'>Active</option>
                          </select>
                        </div>
                      </div>

                      {errors.submit && (
                        <p className='text-sm text-red-600'>{errors.submit}</p>
                      )}

                      <div className='mt-5 sm:mt-4 sm:flex sm:flex-row-reverse'>
                        <button
                          type='submit'
                          disabled={isSubmitting}
                          className='inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {isSubmitting ? 'Creating...' : 'Create Campaign'}
                        </button>
                        <button
                          type='button'
                          className='mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto'
                          onClick={onClose}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
