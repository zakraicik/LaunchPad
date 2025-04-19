import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';

export function useTokenDecimals(tokenAddress: string) {
  const { data: decimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  return decimals;
} 