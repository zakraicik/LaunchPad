import { useState, useEffect } from 'react'
import { formatTimeLeft } from '../../utils/format'
import { useHydration } from '../../pages/_app'

interface CampaignTimerProps {
  startTime: number // Unix timestamp in seconds
  endTime: number // Unix timestamp in seconds
  duration: number // Duration in days
  className?: string
}

export default function CampaignTimer({
  startTime,
  endTime,
  duration,
  className = ''
}: CampaignTimerProps) {
  const { isHydrated } = useHydration()
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    // Skip if not hydrated
    if (!isHydrated) return

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
  }, [endTime, isHydrated])

  // Optionally provide a simple placeholder during SSR
  if (!isHydrated) {
    return <div className={`text-2xl font-bold ${className}`}>--:--:--</div>
  }

  return (
    <div className={`text-2xl font-bold ${className}`}>
      {formatTimeLeft(timeLeft)}
    </div>
  )
}
