import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import { useHydration } from "../../pages/_app";
import CampaignABI from "../../../artifacts/contracts/Campaign.sol/Campaign.json";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";

export const useAdminOverrideStatus = (campaignAddress?: string) => {
  const { data: walletClient } = useWalletClient();
  const { isHydrated } = useHydration();

  const {
    data: isOverrideEnabled = false,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["adminOverrideStatus", campaignAddress],
    queryFn: async () => {
      if (!campaignAddress || !walletClient) return false;

      try {
        // First check Firebase
        const campaignRef = doc(db, "campaigns", campaignAddress);
        const campaignDoc = await getDoc(campaignRef);

        if (campaignDoc.exists()) {
          const data = campaignDoc.data();
          if (typeof data.adminOverride === "boolean") {
            return data.adminOverride;
          }
        }

        // If not in Firebase, check smart contract
        const provider = new BrowserProvider(walletClient.transport);
        const campaignContract = new Contract(
          campaignAddress,
          CampaignABI.abi,
          provider
        );

        const isOverrideEnabled =
          await campaignContract.isAdminOverrideActive();
        return isOverrideEnabled;
      } catch (error) {
        console.error("Error fetching admin override status:", error);
        return false;
      }
    },
    enabled: isHydrated && !!campaignAddress && !!walletClient,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    isOverrideEnabled,
    isLoading,
    error,
    refetch,
  };
};
