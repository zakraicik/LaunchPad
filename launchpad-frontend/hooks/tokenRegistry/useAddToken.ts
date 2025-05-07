import { useWalletClient, useChainId } from "wagmi";
import { getContractAddress } from "@/config/addresses";
import { TOKEN_REGISTRY_ABI } from "../../public/abis/tokenRegistry";
import { useState } from "react";
import { ethers } from "ethers";
import { useHydration } from "@/pages/_app";

export function useAddToken() {
  const { isHydrated } = useHydration();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToken = async (tokenAddress: string, minContribution: string) => {
    // Early return if not hydrated yet
    if (!isHydrated) {
      setError("Client not yet hydrated");
      return null;
    }

    try {
      setIsAdding(true);
      setError(null);

      if (!walletClient) {
        throw new Error("Please connect your wallet");
      }

      // Get the provider and signer from Wagmi
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Get the correct contract address for this network
      const registryAddress = getContractAddress(
        (chainId || 8453) as 8453,
        "tokenRegistry"
      );

      // Create contract instance
      const registry = new ethers.Contract(
        registryAddress,
        TOKEN_REGISTRY_ABI,
        signer
      );

      // Call the addToken function
      const tx = await registry.addToken(tokenAddress, minContribution);

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    } catch (err) {
      console.error("Error adding token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add token";
      setError(errorMessage);
      throw err;
    } finally {
      setIsAdding(false);
    }
  };

  return {
    addToken,
    isAdding,
    error,
    isHydrated,
  };
}
