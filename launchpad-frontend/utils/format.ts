/**
 * Format a number with commas as thousand separators
 * @param value The number to format
 * @returns The formatted number as a string
 */
export function formatNumber (value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format a date in a human-readable format
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatDate (timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format a duration in days to a human-readable string
 * @param days Number of days
 * @returns Formatted duration string
 */
export function formatDuration (days: number): string {
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'}`
  } else if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'}`
  } else {
    const months = Math.floor(days / 30)
    return `${months} month${months === 1 ? '' : 's'}`
  }
}

/**
 * Format a time duration from seconds to a human-readable string
 * @param seconds Number of seconds
 * @returns Formatted time string
 */
export function formatTimeLeft (seconds: number): string {
  if (seconds <= 0) {
    return 'Ended'
  }

  const days = Math.floor(seconds / (24 * 60 * 60))
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}
