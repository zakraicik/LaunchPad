import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useHydration } from "../../pages/_app";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to check if a campaign is authorized
 * @param campaignAddress The address of the campaign to check
 * @returns Object containing authorization status and loading state
 */
export const useCampaignAuthorization = (campaignAddress?: string) => {
  const { isHydrated } = useHydration();

  const {
    data: isAuthorized = true,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["campaignAuthorization", campaignAddress],
    queryFn: async () => {
      if (!campaignAddress) return true;

      try {
        const authCampaignRef = doc(db, "authorizedCampaigns", campaignAddress);
        const authCampaignDoc = await getDoc(authCampaignRef);

        if (authCampaignDoc.exists()) {
          const data = authCampaignDoc.data();
          return data.isAuthorized === true; // Explicitly check for true
        } else {
          // If no document exists, we assume the campaign is not yet registered
          // This might happen during deployment or for newer campaigns
          console.log(
            "No authorization document found for campaign:",
            campaignAddress
          );
          return true;
        }
      } catch (error) {
        console.error("Error checking campaign authorization:", error);
        // Default to true in case of error to avoid blocking legitimate campaigns
        return true;
      }
    },
    enabled: isHydrated && !!campaignAddress,
    // Refetch periodically to catch authorization changes
    refetchInterval: 60 * 1000, // 1 minute
  });

  return {
    isAuthorized,
    isLoading,
    error: error as Error | null,
    refetch,
    isHydrated,
  };
};
