/**
 * Generates a deterministic avatar URL for a given wallet address using DiceBear API
 * @param address Ethereum wallet address
 * @returns Avatar URL string
 */
export function generateAvatar(address: string): string {
  // Use DiceBear's identicon style for deterministic avatar generation
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address.toLowerCase()}`
} 