import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { useHydration } from '../pages/_app';

export function useTokenDecimals(tokenAddress: string) {
  const { isHydrated } = useHydration();
  
  const shouldRead = isHydrated && !!tokenAddress;
  
  const { data: decimals } = useReadContract({
    address: shouldRead ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  return { decimals, isHydrated };
}