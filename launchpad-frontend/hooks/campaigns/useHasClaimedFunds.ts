import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CAMPAIGN_ABI } from "../../public/abis/campaign";
import { useHydration } from "../../pages/_app";

export const useHasClaimedFunds = (campaignAddress?: string) => {
  const { isHydrated } = useHydration();
  const { data: walletClient } = useWalletClient();

  const { data: hasClaimed = false, isLoading: isChecking } = useQuery({
    queryKey: ["hasClaimedFunds", campaignAddress],
    queryFn: async () => {
      if (!walletClient || !campaignAddress) return false;

      try {
        const provider = new BrowserProvider(walletClient.transport);
        const signer = await provider.getSigner();

        // Create campaign contract instance
        const campaignContract = new Contract(
          campaignAddress,
          CAMPAIGN_ABI,
          signer
        );

        // Call hasClaimedFunds function (view function, no transaction)
        return await campaignContract.hasClaimedFunds();
      } catch (error) {
        console.error("Error checking if funds have been claimed:", error);
        return false;
      }
    },
    // Only enable query when hydrated
    enabled: !!walletClient && !!campaignAddress && isHydrated,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  return { hasClaimed, isChecking };
};
