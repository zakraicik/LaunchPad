import { useReadContract, useReadContracts, useChainId } from 'wagmi'
import { getContractAddress } from '../config/addresses'
import TokenRegistryABI from '../abis/TokenRegistry.json'
import { type Abi } from 'viem'
import { erc20Abi } from 'viem'

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
    abi: TokenRegistryABI as Abi,
    functionName: 'getAllSupportedTokens'
  })

  const { data: tokenConfigs } = useReadContracts({
    contracts: (supportedTokens as string[] || []).map(address => ({
      address: getContractAddress((chainId || 84532) as 84532, 'tokenRegistry') as `0x${string}`,
      abi: TokenRegistryABI as Abi,
      functionName: 'getMinContributionAmount',
      args: [address]
    }))
  })

  const { data: tokenSymbols } = useReadContracts({
    contracts: (supportedTokens as string[] || []).map(address => ({
      address: address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'symbol'
    }))
  })

  const { data: tokenNames } = useReadContracts({
    contracts: (supportedTokens as string[] || []).map(address => ({
      address: address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'name'
    }))
  })

  const tokens = (supportedTokens as string[] | undefined)?.map((address: string, index: number) => {
    const config = tokenConfigs?.[index]?.result
    if (!config) return null
    const [minAmount, decimals] = config as [bigint, number]
    return {
      address,
      name: tokenNames?.[index]?.result?.toString() || address.slice(0, 6) + '...' + address.slice(-4),
      symbol: tokenSymbols?.[index]?.result?.toString() || address.slice(0, 6) + '...' + address.slice(-4),
      isSupported: true,
      minAmount: minAmount.toString(),
      decimals
    } as TokenInfo
  }).filter(Boolean) as TokenInfo[]

  return { tokens }
}
