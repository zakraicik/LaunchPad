import { useState } from "react";
import { Contract, BrowserProvider, ethers } from "ethers";
import { useWalletClient } from "wagmi";
import { CAMPAIGN_ABI } from "../../config/abis/campaign";
import toast from "react-hot-toast";

// Campaign error codes from the contract
const CAMPAIGN_ERRORS: Record<number, string> = {
  1: "Invalid address provided",
  2: "Invalid amount provided",
  3: "ETH transfers are not accepted",
  4: "Campaign is still active",
  5: "Campaign has passed its end date",
  6: "Campaign goal has been reached",
  7: "Admin override is active",
  8: "Funds have already been claimed",
  9: "Funds have not been claimed yet",
  10: "No funds available to withdraw",
  11: "You have already been refunded",
  12: "No funds available to refund",
  13: "Campaign constructor validation failed",
};

// Error codes from DefiIntegrationManager.sol
const DEFI_ERROR_CODES = {
  ERR_WITHDRAWAL_DOESNT_BALANCE: 1,
  ERR_WITHDRAWAL_FAILED: 2,
} as const;

export const useClaimFunds = () => {
  const { data: walletClient } = useWalletClient();
  const [isClaiming, setIsClaiming] = useState(false);

  const parseContractError = (error: any): string => {
    // Check if it's a CampaignError from the contract
    if (error?.data?.data) {
      try {
        const decodedError = CAMPAIGN_ABI.find(
          (item: any) => item.type === "error" && item.name === "CampaignError"
        );

        if (decodedError) {
          const decoded = new Contract(
            "0x0000000000000000000000000000000000000000",
            [decodedError]
          ).interface.decodeErrorResult("CampaignError", error.data.data);

          const errorCode = Number(decoded[0]);
          return CAMPAIGN_ERRORS[errorCode] || "Unknown campaign error";
        }
      } catch (e) {
        console.error("Error decoding contract error:", e);
      }
    }

    // Handle gas estimation failures
    if (error?.action === "estimateGas") {
      return "Unable to estimate gas - contract may be in an invalid state or the transaction may not be possible";
    }

    // Handle common transaction errors
    if (error?.code === "ACTION_REJECTED") {
      return "Transaction was rejected by user";
    }

    if (error?.code === "INSUFFICIENT_FUNDS") {
      return "Insufficient funds for transaction";
    }

    // Handle transaction revert errors
    if (error?.receipt?.status === 0) {
      return "Transaction failed - contract may be paused or in an invalid state";
    }

    // Handle missing revert data
    if (error?.message?.includes("missing revert data")) {
      return "Transaction failed - contract may be paused or in an invalid state";
    }

    // Handle transaction execution reverted
    if (error?.message?.includes("transaction execution reverted")) {
      return "Transaction failed - contract may be paused or in an invalid state";
    }

    // Handle internal JSON-RPC errors
    if (error?.code === -32603) {
      return "Internal JSON-RPC error occurred";
    }

    // Return the error message if available, otherwise a generic message
    return error?.message || "An unknown error occurred";
  };

  const claimFunds = async (campaignAddress: string) => {
    if (!walletClient || !campaignAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsClaiming(true);
    let toastId = toast.loading("Initiating claim...");

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Create campaign contract instance
      const campaignContract = new Contract(
        campaignAddress,
        CAMPAIGN_ABI,
        signer
      );

      // Call claimFunds function
      const tx = await campaignContract.claimFunds({
        gasLimit: 1000000,
        // maxFeePerGas: 20000000000,
        // maxPriorityFeePerGas: 2000000000
      });
      toast.dismiss(toastId);
      toastId = toast.loading("Transaction sent. Waiting for confirmation...");

      await tx.wait();

      toast.dismiss(toastId);
      toast.success("Funds claimed successfully!");
      return tx.hash;
    } catch (error: any) {
      console.error("Error claiming funds:", error);
      toast.dismiss(toastId);
      // Don't show toast for user rejections
      if (error.code !== "ACTION_REJECTED") {
        const errorMessage = parseContractError(error);
        toast.error(errorMessage);
      }
      throw error;
    } finally {
      setIsClaiming(false);
    }
  };

  return { claimFunds, isClaiming };
};
