import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  BellIcon,
  WalletIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  FolderIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import { useCampaigns } from '../hooks/useCampaigns'
import { formatEther } from 'ethers'
import { formatDistanceToNow } from 'date-fns'
import { GetServerSideProps } from 'next'

interface NotificationPreferences {
  yieldEarned: boolean
  campaignUpdates: boolean
  refundAvailable: boolean
  emailNotifications: boolean
}

interface UserProfile {
  displayName: string
  email: string
  bio: string
}

export const getServerSideProps: GetServerSideProps = async context => {
  return {
    props: {}
  }
}

export default function Account () {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'campaigns' | 'analytics' | 'notifications'
  >('campaigns')
  const { campaigns, isLoading: isLoadingCampaigns } = useCampaigns()

  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>({
      yieldEarned: true,
      campaignUpdates: true,
      refundAvailable: true,
      emailNotifications: false
    })

  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    email: '',
    bio: ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleProfileChange = (key: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSavedMessage('Settings saved successfully!')
    setTimeout(() => setSavedMessage(''), 3000)
    setIsSaving(false)
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Recently'
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch (error) {
      return 'Recently'
    }
  }

  const renderCampaignsList = () => (
    <div className='space-y-4'>
      {isLoadingCampaigns ? (
        <div className='text-center py-8'>Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className='text-center py-8'>No campaigns found</div>
      ) : (
        campaigns.map(campaign => (
          <div
            key={campaign.id}
            className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden'
          >
            <div className='p-4'>
              <div className='flex justify-between items-start'>
                <div>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    {campaign.title}
                  </h3>
                  <p className='text-sm text-gray-500 mt-1'>
                    {campaign.description}
                  </p>
                  {campaign.category && (
                    <span className='inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full'>
                      {campaign.category}
                    </span>
                  )}
                </div>
                <div className='flex items-center space-x-2'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : campaign.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {campaign.status.charAt(0).toUpperCase() +
                      campaign.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='text-gray-600'>Raised</span>
                  <p className='font-medium'>
                    {campaign.totalRaised
                      ? formatEther(campaign.totalRaised)
                      : '0'}{' '}
                    ETH
                  </p>
                </div>
                <div>
                  <span className='text-gray-600'>Target</span>
                  <p className='font-medium'>
                    {campaign.targetAmount
                      ? formatEther(campaign.targetAmount)
                      : '0'}{' '}
                    ETH
                  </p>
                </div>
                <div>
                  <span className='text-gray-600'>Backers</span>
                  <p className='font-medium'>{campaign.contributors || 0}</p>
                </div>
                <div>
                  <span className='text-gray-600'>APY</span>
                  <p className='font-medium'>{campaign.currentAPY || 0}%</p>
                </div>
              </div>

              <div className='mt-4 text-sm text-gray-500'>
                Created {formatDate(campaign.createdAt)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )

  if (!mounted) return null

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <div className='bg-white rounded-lg shadow'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-8'>
                <div className='flex items-center space-x-4'>
                  <UserCircleIcon className='h-12 w-12 text-gray-400' />
                  <div>
                    <h1 className='text-2xl font-bold text-gray-900'>
                      {profile.displayName || 'Your Account'}
                    </h1>
                    <p className='text-sm text-gray-500'>
                      {address
                        ? `${address.slice(0, 6)}...${address.slice(-4)}`
                        : 'Not connected'}
                    </p>
                  </div>
                </div>
                <div className='flex items-center space-x-4'>
                  <ConnectButton />
                  {address && (
                    <button
                      onClick={() => disconnect()}
                      className='text-sm text-red-600 hover:text-red-700'
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              <div className='border-b border-gray-200 mb-8'>
                <nav className='-mb-px flex space-x-8'>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`${
                      activeTab === 'campaigns'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    <FolderIcon className='h-5 w-5 inline-block mr-2' />
                    Your Campaigns
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`${
                      activeTab === 'notifications'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    <BellIcon className='h-5 w-5 inline-block mr-2' />
                    Notifications
                  </button>
                </nav>
              </div>

              {activeTab === 'campaigns' && renderCampaignsList()}

              {activeTab === 'notifications' && (
                <div className='space-y-6'>
                  <div>
                    <h2 className='text-lg font-medium text-gray-900 mb-4'>
                      Notification Preferences
                    </h2>
                    <div className='space-y-4'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h3 className='text-sm font-medium text-gray-900'>
                            Yield Earned
                          </h3>
                          <p className='text-sm text-gray-500'>
                            Get notified when you earn yield
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleNotificationToggle('yieldEarned')
                          }
                          className={`${
                            notificationPreferences.yieldEarned
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        >
                          <span
                            className={`${
                              notificationPreferences.yieldEarned
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                          />
                        </button>
                      </div>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h3 className='text-sm font-medium text-gray-900'>
                            Campaign Updates
                          </h3>
                          <p className='text-sm text-gray-500'>
                            Get notified about campaign progress
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleNotificationToggle('campaignUpdates')
                          }
                          className={`${
                            notificationPreferences.campaignUpdates
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        >
                          <span
                            className={`${
                              notificationPreferences.campaignUpdates
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                          />
                        </button>
                      </div>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h3 className='text-sm font-medium text-gray-900'>
                            Refund Available
                          </h3>
                          <p className='text-sm text-gray-500'>
                            Get notified when refunds are available
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleNotificationToggle('refundAvailable')
                          }
                          className={`${
                            notificationPreferences.refundAvailable
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        >
                          <span
                            className={`${
                              notificationPreferences.refundAvailable
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                          />
                        </button>
                      </div>
                      <div className='flex items-center justify-between'>
                        <div>
                          <h3 className='text-sm font-medium text-gray-900'>
                            Email Notifications
                          </h3>
                          <p className='text-sm text-gray-500'>
                            Receive notifications via email
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleNotificationToggle('emailNotifications')
                          }
                          className={`${
                            notificationPreferences.emailNotifications
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                        >
                          <span
                            className={`${
                              notificationPreferences.emailNotifications
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className='text-lg font-medium text-gray-900 mb-4'>
                      Profile Settings
                    </h2>
                    <div className='space-y-4'>
                      <div>
                        <label
                          htmlFor='displayName'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Display Name
                        </label>
                        <input
                          type='text'
                          id='displayName'
                          value={profile.displayName}
                          onChange={e =>
                            handleProfileChange('displayName', e.target.value)
                          }
                          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='email'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Email
                        </label>
                        <input
                          type='email'
                          id='email'
                          value={profile.email}
                          onChange={e =>
                            handleProfileChange('email', e.target.value)
                          }
                          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                        />
                      </div>
                      <div>
                        <label
                          htmlFor='bio'
                          className='block text-sm font-medium text-gray-700'
                        >
                          Bio
                        </label>
                        <textarea
                          id='bio'
                          rows={3}
                          value={profile.bio}
                          onChange={e =>
                            handleProfileChange('bio', e.target.value)
                          }
                          className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='flex justify-end space-x-4'>
                    {savedMessage && (
                      <span className='text-sm text-green-600'>
                        {savedMessage}
                      </span>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
