import { useReadContract, useReadContracts, useChainId } from 'wagmi'
import { getContractAddress } from '@/config/addresses'
import TokenRegistry from '../../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json'
import { type Abi } from 'viem'

interface TokenInfo {
  address: string
  name: string
  symbol: string
  isSupported: boolean
  minAmount: string
  decimals: number
}

export function useTokenRegistry() {
  const chainId = useChainId()

  const { data: supportedTokens } = useReadContract({
    address: getContractAddress((chainId || 84532) as 84532, 'tokenRegistry') as `0x${string}`,
    abi: TokenRegistry.abi,
    functionName: 'getAllSupportedTokens'
  })

  const { data: tokenConfigs } = useReadContracts({
    contracts: (supportedTokens as string[] || []).map(address => ({
      address: getContractAddress((chainId || 84532) as 84532, 'tokenRegistry') as `0x${string}`,
      abi: TokenRegistry.abi as Abi,
      functionName: 'getMinContributionAmount',
      args: [address]
    }))
  })

  const tokens = (supportedTokens as string[] | undefined)?.map((address: string, index: number) => {
    const config = tokenConfigs?.[index]?.result
    if (!config) return null
    const [minAmount, decimals] = config as [bigint, number]
    return {
      address,
      name: address.slice(0, 6) + '...' + address.slice(-4),
      symbol: address.slice(0, 6) + '...' + address.slice(-4),
      isSupported: true,
      minAmount: minAmount.toString(),
      decimals
    } as TokenInfo
  }).filter(Boolean) as TokenInfo[]

  return { tokens }
}
