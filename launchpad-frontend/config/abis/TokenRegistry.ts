export const TokenRegistryABI = [
  {
    inputs: [],
    name: 'getAllSupportedTokens',
    outputs: [{ type: 'address[]', name: '' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ type: 'address', name: 'token' }],
    name: 'getMinContributionAmount',
    outputs: [
      { type: 'uint256', name: 'minimumAmount' },
      { type: 'uint8', name: 'decimals' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ type: 'address', name: 'token' }],
    name: 'isTokenSupported',
    outputs: [{ type: 'bool', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const
