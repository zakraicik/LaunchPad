import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useHydration } from "../../pages/_app";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to check authorization status for multiple campaigns at once
 * @param campaignAddresses Array of campaign addresses to check
 * @returns Object containing authorization map, loading state and hydration status
 */
export const useBulkCampaignAuthorization = (campaignAddresses: string[]) => {
  const { isHydrated } = useHydration();

  const {
    data: authorizationMap = {},
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bulkCampaignAuthorization", campaignAddresses],
    queryFn: async () => {
      if (!campaignAddresses.length) return {};

      const authMap: Record<string, boolean> = {};

      const promises = campaignAddresses.map(async (address) => {
        try {
          const authCampaignRef = doc(db, "authorizedCampaigns", address);
          const authCampaignDoc = await getDoc(authCampaignRef);

          if (authCampaignDoc.exists()) {
            // Get the isAuthorized flag directly from the document
            authMap[address] = authCampaignDoc.data().isAuthorized;
          } else {
            // If no document exists, assume authorized
            authMap[address] = true;
          }
        } catch (error) {
          console.error("Error checking campaign authorization:", error);
          // On error, assume not authorized for safety
          authMap[address] = false;
        }
      });

      await Promise.all(promises);
      return authMap;
    },
    enabled: isHydrated && campaignAddresses.length > 0,
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  return {
    authorizationMap,
    isLoading,
    isHydrated,
    error,
  };
};
