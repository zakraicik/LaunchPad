import { useState } from "react";
import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import CampaignEventCollectorABI from "../../../artifacts/contracts/CampaignEventCollector.sol/CampaignEventCollector.json";
import toast from "react-hot-toast";
import { useHydration } from "../../pages/_app";

export const useDeauthorizeCampaign = () => {
  const { isHydrated } = useHydration();
  const { data: walletClient } = useWalletClient();
  const [isDeauthorizing, setIsDeauthorizing] = useState(false);

  const deauthorizeCampaign = async (
    campaignEventCollectorAddress: string,
    campaignAddress: string
  ) => {
    // Check for hydration first
    if (!isHydrated) {
      toast.error("Client not yet hydrated");
      return;
    }

    if (!walletClient || !campaignAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsDeauthorizing(true);
    let toastId = toast.loading("Initiating deauthorization...");

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Create campaign contract instance
      const campaignEventCollectorContract = new Contract(
        campaignEventCollectorAddress,
        CampaignEventCollectorABI.abi,
        signer
      );

      // Call contribute function
      const tx = await campaignEventCollectorContract.deauthorizeCampaign(
        campaignAddress,
        { gasLimit: 1000000 }
      );
      toast.dismiss(toastId);
      toastId = toast.loading("Transaction sent. Waiting for confirmation...");

      await tx.wait();

      toast.dismiss(toastId);
      toast.success("Deauthorization successful!");
      return tx.hash;
    } catch (error: any) {
      console.error("Error deauthorizing campaign funds:", error);
      toast.dismiss(toastId);
      // Don't show toast for user rejections
      if (error.code !== "ACTION_REJECTED") {
        toast.error(error.message || "Failed to deauthorize campaign");
      }
      throw error;
    } finally {
      setIsDeauthorizing(false);
    }
  };

  return { deauthorizeCampaign, isDeauthorizing, isHydrated };
};
