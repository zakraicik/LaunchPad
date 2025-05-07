import { useState } from "react";
import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import { useHydration } from "../../pages/_app";
import { CAMPAIGN_ABI } from "../../public/abis/campaign";
import toast from "react-hot-toast";

export const useSetAdminOverride = () => {
  const { data: walletClient } = useWalletClient();
  const [isSettingOverride, setIsSettingOverride] = useState(false);
  const { isHydrated } = useHydration();

  const setAdminOverride = async (
    campaignAddress: string,
    override: boolean
  ) => {
    // Check for hydration first
    if (!isHydrated) {
      return;
    }

    if (!walletClient || !campaignAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsSettingOverride(true);
    let toastId = toast.loading(
      `${override ? "Enabling" : "Disabling"} admin override...`
    );

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CAMPAIGN_ABI,
        signer
      );

      // Call setAdminOverride function
      const tx = await campaignContract.setAdminOverride(override, {
        gasLimit: 500000,
      });
      toast.dismiss(toastId);
      toastId = toast.loading("Transaction sent. Waiting for confirmation...");

      await tx.wait();

      toast.dismiss(toastId);
      toast.success(
        `Admin override ${override ? "enabled" : "disabled"} successfully!`
      );
      return tx.hash;
    } catch (error: any) {
      console.error("Error setting admin override:", error);
      toast.dismiss(toastId);
      // Don't show toast for user rejections
      if (error.code !== "ACTION_REJECTED") {
        toast.error(error.message || "Failed to set admin override");
      }
      throw error;
    } finally {
      setIsSettingOverride(false);
    }
  };

  return { setAdminOverride, isSettingOverride };
};
