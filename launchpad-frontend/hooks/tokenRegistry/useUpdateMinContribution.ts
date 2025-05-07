import { useWalletClient, useChainId } from "wagmi";
import { getContractAddress } from "@/config/addresses";
import { TOKEN_REGISTRY_ABI } from "../../public/abis/tokenRegistry";
import { useState } from "react";
import { ethers } from "ethers";
import { useHydration } from "@/pages/_app";

export function useUpdateMinContribution() {
  const { isHydrated } = useHydration();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMinContribution = async (
    tokenAddress: string,
    minAmount: string
  ) => {
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

      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      const registryAddress = getContractAddress(
        (chainId || 84532) as 84532,
        "tokenRegistry"
      );

      const registry = new ethers.Contract(
        registryAddress,
        TOKEN_REGISTRY_ABI,
        signer
      );

      const tx = await registry.updateTokenMinimumContribution(
        tokenAddress,
        minAmount
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    } catch (err) {
      console.error("Error updating minimum contribution:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update minimum contribution";
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateMinContribution,
    isUpdating,
    error,
    isHydrated,
  };
}
