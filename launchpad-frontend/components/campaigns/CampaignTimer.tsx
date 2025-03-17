import { useState, useEffect } from 'react'
import { formatDate, formatDuration, formatTimeLeft } from '../../utils/format'

interface CampaignTimerProps {
  startTime: number // Unix timestamp in seconds
  endTime: number // Unix timestamp in seconds
  duration: number // Duration in days
  className?: string
}

type CampaignStatus = 'upcoming' | 'active' | 'ended'

export default function CampaignTimer ({
  startTime,
  endTime,
  duration,
  className = ''
}: CampaignTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [status, setStatus] = useState<CampaignStatus>('upcoming')

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)

      if (now < startTime) {
        setStatus('upcoming')
        setTimeLeft(startTime - now)
      } else if (now < endTime) {
        setStatus('active')
        setTimeLeft(endTime - now)
      } else {
        setStatus('ended')
        setTimeLeft(0)
      }
    }

    // Update immediately
    updateTimer()

    // Update every minute
    const interval = setInterval(updateTimer, 60 * 1000)

    return () => clearInterval(interval)
  }, [startTime, endTime])

  const getStatusColor = (status: CampaignStatus): string => {
    switch (status) {
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'ended':
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: CampaignStatus): string => {
    switch (status) {
      case 'upcoming':
        return 'Starting in'
      case 'active':
        return 'Time remaining'
      case 'ended':
        return 'Campaign ended'
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className='flex items-center justify-between'>
        {/* Status Badge */}
        <div className='flex items-center space-x-2'>
          <span
            className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
              status
            )}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>

        {/* Timer Display */}
        <div className='text-xl font-semibold text-gray-900'>
          {formatTimeLeft(timeLeft)}
        </div>
      </div>

      {/* Campaign Details */}
      <div className='grid grid-cols-3 gap-4 pt-2 border-t border-gray-100'>
        <div>
          <span className='block text-xs font-medium text-gray-500'>
            Start Date
          </span>
          <span className='block text-sm text-gray-900'>
            {formatDate(startTime)}
          </span>
        </div>
        <div>
          <span className='block text-xs font-medium text-gray-500'>
            End Date
          </span>
          <span className='block text-sm text-gray-900'>
            {formatDate(endTime)}
          </span>
        </div>
        <div>
          <span className='block text-xs font-medium text-gray-500'>
            Duration
          </span>
          <span className='block text-sm text-gray-900'>
            {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
