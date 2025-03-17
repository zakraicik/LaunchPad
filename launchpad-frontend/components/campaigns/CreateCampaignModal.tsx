import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAccount } from 'wagmi'

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CampaignFormData) => Promise<void>
}

export interface CampaignFormData {
  campaignToken: string
  campaignGoalAmount: number
  campaignDuration: number
}

export default function CreateCampaignModal ({
  isOpen,
  onClose,
  onSubmit
}: CreateCampaignModalProps) {
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CampaignFormData>({
    campaignToken: '',
    campaignGoalAmount: 0,
    campaignDuration: 0
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (error) {
      console.error('Error creating campaign:', error)
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
                      <div>
                        <label
                          htmlFor='campaignToken'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Campaign Token
                        </label>
                        <div className='mt-1'>
                          <input
                            type='text'
                            name='campaignToken'
                            id='campaignToken'
                            required
                            className='block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                            placeholder='Token address'
                            value={formData.campaignToken}
                            onChange={e =>
                              setFormData({
                                ...formData,
                                campaignToken: e.target.value
                              })
                            }
                          />
                        </div>
                        <p className='mt-1 text-sm text-gray-500'>
                          Enter the address of the token you want to raise funds
                          in
                        </p>
                      </div>

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
                        <p className='mt-1 text-sm text-gray-500'>
                          Enter the total amount you want to raise
                        </p>
                      </div>

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
                        <p className='mt-1 text-sm text-gray-500'>
                          Enter how long the campaign should run in days
                        </p>
                      </div>

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
