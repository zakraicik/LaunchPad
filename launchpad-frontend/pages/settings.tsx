import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  BellIcon,
  WalletIcon,
  UserCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import ProtectedRoute from '../components/auth/ProtectedRoute'

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

export default function Settings () {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const [activeTab, setActiveTab] = useState<
    'profile' | 'wallet' | 'notifications'
  >('profile')

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

  return (
    <ProtectedRoute>
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold'>Settings</h1>
            <p className='text-gray-600 mt-2'>
              Manage your account preferences and notifications
            </p>
          </div>

          {/* Tabs */}
          <div className='bg-white rounded-lg shadow'>
            <div className='border-b border-gray-200'>
              <nav className='flex space-x-8 px-6' aria-label='Tabs'>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'profile'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <UserCircleIcon className='w-5 h-5 mr-2' />
                    Profile
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('wallet')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'wallet'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <WalletIcon className='w-5 h-5 mr-2' />
                    Wallet
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'notifications'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='flex items-center'>
                    <BellIcon className='w-5 h-5 mr-2' />
                    Notifications
                  </div>
                </button>
              </nav>
            </div>

            <div className='p-6'>
              {/* Profile Settings */}
              {activeTab === 'profile' && (
                <div className='space-y-6'>
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
                      placeholder='Enter your display name'
                    />
                  </div>

                  <div>
                    <label
                      htmlFor='email'
                      className='block text-sm font-medium text-gray-700'
                    >
                      Email Address
                    </label>
                    <input
                      type='email'
                      id='email'
                      value={profile.email}
                      onChange={e =>
                        handleProfileChange('email', e.target.value)
                      }
                      className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                      placeholder='Enter your email'
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
                      onChange={e => handleProfileChange('bio', e.target.value)}
                      className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm'
                      placeholder='Tell us about yourself'
                    />
                  </div>
                </div>
              )}

              {/* Wallet Settings */}
              {activeTab === 'wallet' && (
                <div className='space-y-6'>
                  <div className='bg-gray-50 rounded-lg p-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Connected Wallet
                        </h3>
                        <p className='text-sm text-gray-500 mt-1'>
                          {address
                            ? `${address.slice(0, 6)}...${address.slice(-4)}`
                            : 'No wallet connected'}
                        </p>
                      </div>
                      <ConnectButton />
                    </div>
                  </div>

                  {address && (
                    <div>
                      <button
                        onClick={() => disconnect()}
                        className='text-red-600 hover:text-red-700 text-sm font-medium'
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  )}

                  <div className='border-t pt-4'>
                    <h3 className='text-sm font-medium text-gray-900 mb-4'>
                      Security Tips
                    </h3>
                    <ul className='space-y-2 text-sm text-gray-600'>
                      <li>• Never share your private keys or seed phrase</li>
                      <li>
                        • Always verify transaction details before signing
                      </li>
                      <li>• Be cautious of phishing attempts</li>
                      <li>
                        • Consider using a hardware wallet for added security
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className='space-y-6'>
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Yield Earned
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Get notified when you earn yield from your
                          contributions
                        </p>
                      </div>
                      <button
                        onClick={() => handleNotificationToggle('yieldEarned')}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.yieldEarned
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.yieldEarned
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Campaign Updates
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Receive updates about campaigns you've supported
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleNotificationToggle('campaignUpdates')
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.campaignUpdates
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.campaignUpdates
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div>
                        <h3 className='text-sm font-medium text-gray-900'>
                          Refund Available
                        </h3>
                        <p className='text-sm text-gray-500'>
                          Get notified when refunds become available
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleNotificationToggle('refundAvailable')
                        }
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.refundAvailable
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.refundAvailable
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notificationPreferences.emailNotifications
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notificationPreferences.emailNotifications
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className='mt-6 flex items-center justify-end space-x-4'>
                {savedMessage && (
                  <div className='flex items-center text-green-600'>
                    <CheckCircleIcon className='w-5 h-5 mr-2' />
                    <span>{savedMessage}</span>
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
