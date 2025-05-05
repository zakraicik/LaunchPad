/**
 * Format a number with commas as thousand separators
 * @param value The number to format
 * @returns The formatted number as a string
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format a time duration from seconds to a human-readable string
 * @param seconds Number of seconds
 * @returns Formatted time string
 */
export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) {
    return "Ended";
  }

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Shortens an Ethereum address to a more readable format
 * @param address Full Ethereum address
 * @param chars Number of characters to show at start and end (default: 4)
 * @returns Shortened address string
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  if (address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
