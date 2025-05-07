import { useState } from "react";
import { Contract, BrowserProvider } from "ethers";
import { useWalletClient } from "wagmi";
import { CAMPAIGN_ABI } from "../../public/abis/campaign";
import { erc20Abi } from "viem";
import toast from "react-hot-toast";

export const useContribute = () => {
  const { data: walletClient } = useWalletClient();
  const [isContributing, setIsContributing] = useState(false);

  const contribute = async (campaignAddress: string, amount: bigint) => {
    if (!walletClient || !campaignAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsContributing(true);
    let toastId = toast.loading("Initiating contribution...");

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CAMPAIGN_ABI,
        signer
      );

      // Get the token address for this campaign
      const campaignTokenAddress = await campaignContract.campaignToken();

      // Create token contract instance
      const tokenContract = new Contract(
        campaignTokenAddress,
        erc20Abi,
        signer
      );

      // Check current allowance
      const signerAddress = await signer.getAddress();
      const currentAllowance = await tokenContract.allowance(
        signerAddress,
        campaignAddress
      );

      // If allowance is less than amount, request approval
      if (currentAllowance < amount) {
        toast.dismiss(toastId);
        toastId = toast.loading("Approving token transfer...");

        const approveTx = await tokenContract.approve(campaignAddress, amount);
        await approveTx.wait();

        toast.dismiss(toastId);
        toastId = toast.loading(
          "Approval successful. Processing contribution..."
        );
      }

      // Call contribute function
      const tx = await campaignContract.contribute(amount, {
        gasLimit: 1000000,
      });
      toast.dismiss(toastId);
      toastId = toast.loading("Transaction sent. Waiting for confirmation...");

      await tx.wait();

      toast.dismiss(toastId);
      toast.success("Contribution successful!");
      return tx.hash;
    } catch (error: any) {
      console.error("Error contributing funds:", error);
      toast.dismiss(toastId);
      // Don't show toast for user rejections
      if (error.code !== "ACTION_REJECTED") {
        toast.error(error.message || "Failed to contribute");
      }
      throw error;
    } finally {
      setIsContributing(false);
    }
  };

  return { contribute, isContributing };
};
