import { useState } from "react";
import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import { CAMPAIGN_ABI } from "../../config/abis/campaign";
import toast from "react-hot-toast";

export const useRequestRefund = () => {
  const { data: walletClient } = useWalletClient();
  const [isRequestingRefund, setIsRequestingRefund] = useState(false);

  const requestRefund = async (campaignAddress: string) => {
    if (!walletClient || !campaignAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsRequestingRefund(true);
    let toastId = toast.loading("Initiating refund request...");

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CAMPAIGN_ABI,
        signer
      );

      // Call requestRefund function
      const tx = await campaignContract.requestRefund({ gasLimit: 1000000 });
      toast.dismiss(toastId);
      toastId = toast.loading("Transaction sent. Waiting for confirmation...");

      await tx.wait();

      toast.dismiss(toastId);
      toast.success("Refund requested successfully!");
      return tx.hash;
    } catch (error: any) {
      console.error("Error requesting refund:", error);
      toast.dismiss(toastId);
      // Don't show toast for user rejections
      if (error.code !== "ACTION_REJECTED") {
        toast.error(error.message || "Failed to request refund");
      }
      throw error;
    } finally {
      setIsRequestingRefund(false);
    }
  };

  return { requestRefund, isRequestingRefund };
};
