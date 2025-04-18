import { useState, useEffect } from 'react'
import { formatTimeLeft } from '../../utils/format'

interface CampaignTimerProps {
  startTime: number // Unix timestamp in seconds
  endTime: number // Unix timestamp in seconds
  duration: number // Duration in days
  className?: string
}

export default function CampaignTimer ({
  startTime,
  endTime,
  duration,
  className = ''
}: CampaignTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)
      if (now < endTime) {
        setTimeLeft(endTime - now)
      } else {
        setTimeLeft(0)
      }
    }

    // Update immediately
    updateTimer()

    // Update every minute
    const interval = setInterval(updateTimer, 60 * 1000)

    return () => clearInterval(interval)
  }, [endTime])

  return (
    <div className={`text-2xl font-bold ${className}`}>
      {formatTimeLeft(timeLeft)}
    </div>
  )
}
