import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useChainId } from "wagmi";
import { CONTRACT_ADDRESSES, SUPPORTED_NETWORKS } from "../config/addresses";
import { PLATFORM_ADMIN_ABI } from "../public/abis/platformAdmin";

// Cache for admin status to avoid excessive RPC calls
const adminStatusCache = new Map<
  string,
  { status: boolean; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useIsAdmin(address?: string) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const checkAdminStatus = useCallback(async () => {
    if (!address || !publicClient || !chainId) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // Ensure chainId is one of our supported networks
    if (
      !SUPPORTED_NETWORKS.includes(
        chainId as (typeof SUPPORTED_NETWORKS)[number]
      )
    ) {
      console.error("Unsupported network:", chainId);
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Check cache first
    const cached = adminStatusCache.get(normalizedAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setIsAdmin(cached.status);
      setIsLoading(false);
      return;
    }

    try {
      const isAdminStatus = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES[
          chainId as (typeof SUPPORTED_NETWORKS)[number]
        ].platformAdmin as `0x${string}`,
        abi: PLATFORM_ADMIN_ABI,
        functionName: "isPlatformAdmin",
        args: [address as `0x${string}`],
      })) as boolean;

      // Update cache
      adminStatusCache.set(normalizedAddress, {
        status: isAdminStatus,
        timestamp: Date.now(),
      });

      setIsAdmin(isAdminStatus);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, chainId]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  return { isAdmin, isLoading, refresh: checkAdminStatus };
}
