import { useWalletClient, useChainId } from "wagmi";
import { getContractAddress } from "@/config/addresses";
import { FEE_MANAGER_ABI } from "../../config/abis/feeManager";
import { useState } from "react";
import { ethers } from "ethers";
import { useHydration } from "@/pages/_app";

export function useUpdatePlatformTreasury() {
  const { isHydrated } = useHydration();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePlatformTreasury = async (treasuryAddress: string) => {
    // Early return if not hydrated yet
    if (!isHydrated) {
      setError("Client not yet hydrated");
      return null;
    }

    try {
      setIsUpdating(true);
      setError(null);

      if (!walletClient) {
        throw new Error("Please connect your wallet");
      }

      // Get the provider and signer from Wagmi
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Get the correct contract address for this network
      const feeManagerAddress = getContractAddress(
        (chainId || 84532) as 84532,
        "feeManager"
      );

      // Create contract instance
      const feeManager = new ethers.Contract(
        feeManagerAddress,
        FEE_MANAGER_ABI,
        signer
      );

      // Call the addToken function
      const tx = await feeManager.updatePlatformTreasury(treasuryAddress);

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    } catch (err) {
      console.error("Error updating platform treasury:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update platform treasury";
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updatePlatformTreasury,
    isUpdating,
    error,
    isHydrated,
  };
}
