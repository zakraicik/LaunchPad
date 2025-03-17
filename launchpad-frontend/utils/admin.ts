// List of admin addresses (in production this should come from the smart contract)
const ADMIN_ADDRESSES = ['0xBF8E22884D8d91434bC162ff6514F61dbD6Fa67A'].map(
  addr => addr.toLowerCase()
)

export const isAdmin = (address?: string): boolean => {
  if (!address) return false
  return ADMIN_ADDRESSES.includes(address.toLowerCase())
}
