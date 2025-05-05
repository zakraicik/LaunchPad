import { useWalletClient, useChainId } from "wagmi";
import { getContractAddress } from "@/config/addresses";
import { PLATFORM_ADMIN_ABI } from "../../config/abis/platformAdmin";
import { ethers } from "ethers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHydration } from "@/pages/_app";

export function useRemovePlatformAdmin() {
  const { isHydrated } = useHydration();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (adminAddress: string) => {
      // Check for hydration first
      if (!isHydrated) {
        throw new Error("Client not yet hydrated");
      }

      if (!walletClient) {
        throw new Error("Please connect your wallet");
      }

      // Get the provider and signer from Wagmi
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // Get the correct contract address for this network
      const platformAdminAddress = getContractAddress(
        (chainId || 84532) as 84532,
        "platformAdmin"
      );

      // Create contract instance
      const platformAdmin = new ethers.Contract(
        platformAdminAddress,
        PLATFORM_ADMIN_ABI,
        signer
      );

      // Call the removePlatformAdmin function
      const tx = await platformAdmin.removePlatformAdmin(adminAddress, {
        gasLimit: 1000000,
      });

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
      };
    },
    onSuccess: () => {
      // Only invalidate queries if hydrated
      if (isHydrated) {
        queryClient.invalidateQueries({
          queryKey: ["platformAdmins", chainId],
        });
      }
    },
  });

  return {
    removePlatformAdmin: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    isHydrated,
  };
}
