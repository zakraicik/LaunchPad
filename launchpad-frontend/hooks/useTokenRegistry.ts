import { useState, useEffect } from 'react'
import { useContractReads, usePublicClient } from 'wagmi'
import { type Address, formatUnits } from 'viem'
import { TokenRegistryAddress } from '../config/addresses'
import { TokenRegistryABI } from '../config/abis/TokenRegistry'

export interface Token {
  address: Address
  symbol: string
  name: string
  decimals: number
  minimumContribution: number
}

export function useTokenRegistry () {
  const [supportedTokens, setSupportedTokens] = useState<Token[]>([])
  const publicClient = usePublicClient()

  const { data: tokenAddresses } = useContractReads({
    contracts: [
      {
        address: TokenRegistryAddress,
        abi: TokenRegistryABI,
        functionName: 'getAllSupportedTokens'
      }
    ]
  })

  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!tokenAddresses?.[0]?.result || !publicClient) return

      const addresses = tokenAddresses[0].result as Address[]
      const tokenDetails = await Promise.all(
        addresses.map(async address => {
          const [symbol, name, decimals, minContributionResult] =
            await Promise.all([
              publicClient.readContract({
                address,
                abi: [
                  {
                    inputs: [],
                    name: 'symbol',
                    outputs: [{ type: 'string', name: '' }],
                    stateMutability: 'view',
                    type: 'function'
                  }
                ],
                functionName: 'symbol'
              }),
              publicClient.readContract({
                address,
                abi: [
                  {
                    inputs: [],
                    name: 'name',
                    outputs: [{ type: 'string', name: '' }],
                    stateMutability: 'view',
                    type: 'function'
                  }
                ],
                functionName: 'name'
              }),
              publicClient.readContract({
                address,
                abi: [
                  {
                    inputs: [],
                    name: 'decimals',
                    outputs: [{ type: 'uint8', name: '' }],
                    stateMutability: 'view',
                    type: 'function'
                  }
                ],
                functionName: 'decimals'
              }),
              publicClient.readContract({
                address: TokenRegistryAddress,
                abi: TokenRegistryABI,
                functionName: 'getMinContributionAmount',
                args: [address]
              })
            ])

          const [minimumAmount, minDecimals] =
            minContributionResult as readonly [bigint, number]

          return {
            address,
            symbol: symbol as string,
            name: name as string,
            decimals: decimals as number,
            minimumContribution: Number(formatUnits(minimumAmount, minDecimals))
          }
        })
      )

      setSupportedTokens(tokenDetails)
    }

    fetchTokenDetails()
  }, [tokenAddresses, publicClient])

  const getMinContribution = async (tokenAddress: Address): Promise<number> => {
    if (!publicClient) return 0

    const token = supportedTokens.find(t => t.address === tokenAddress)
    if (token) return token.minimumContribution

    const [decimals, minContributionResult] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: 'decimals',
            outputs: [{ type: 'uint8', name: '' }],
            stateMutability: 'view',
            type: 'function'
          }
        ],
        functionName: 'decimals'
      }),
      publicClient.readContract({
        address: TokenRegistryAddress,
        abi: TokenRegistryABI,
        functionName: 'getMinContributionAmount',
        args: [tokenAddress]
      })
    ])

    const [minimumAmount, minDecimals] = minContributionResult as readonly [
      bigint,
      number
    ]

    return Number(formatUnits(minimumAmount, minDecimals))
  }

  return {
    supportedTokens,
    getMinContribution
  }
}
