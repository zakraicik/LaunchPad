import { useState, useRef, useEffect } from "react";
import { useFeeManager } from "@/hooks/feeManagement/useFeeManager";
import { formatDistanceToNow, isValid } from "date-fns";
import {
  PencilIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useIsAdmin } from "@/utils/admin";
import { useAccount } from "wagmi";
import { Timestamp } from "firebase/firestore";
import { useHydration } from "@/pages/_app";
import { useUpdatePlatformFeeShare } from "@/hooks/feeManagement/useUpdatePlatformFeeShare";
import { useUpdatePlatformTreasury } from "@/hooks/feeManagement/useUpdatePlatformTreasury";
import toast from "react-hot-toast";

export default function FeeManagement() {
  const { isHydrated } = useHydration();
  const { feeSettings, isLoading, error, refetch } = useFeeManager();
  const { address } = useAccount();
  const { isAdmin } = useIsAdmin(address);
  const [isEditFeeShareModalOpen, setIsEditFeeShareModalOpen] = useState(false);
  const [isEditTreasuryModalOpen, setIsEditTreasuryModalOpen] = useState(false);
  const [showAddressPopover, setShowAddressPopover] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [feeShare, setFeeShare] = useState<number | "">("");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [feeShareError, setFeeShareError] = useState<string | null>(null);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [isSavingFeeShare, setIsSavingFeeShare] = useState(false);
  const [isSavingTreasury, setIsSavingTreasury] = useState(false);
  const { updatePlatformFeeShare, isUpdating: isUpdatingFeeShare } =
    useUpdatePlatformFeeShare();
  const { updatePlatformTreasury, isUpdating: isUpdatingTreasury } =
    useUpdatePlatformTreasury();

  useEffect(() => {
    if (!isHydrated) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowAddressPopover(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHydrated]);

  useEffect(() => {
    if (isEditFeeShareModalOpen && feeSettings) {
      setFeeShare(feeSettings.platformFeeShare || "");
      setFeeShareError(null);
    }
  }, [isEditFeeShareModalOpen, feeSettings]);

  useEffect(() => {
    if (isEditTreasuryModalOpen && feeSettings) {
      setTreasuryAddress(feeSettings.treasuryAddress || "");
      setTreasuryError(null);
    }
  }, [isEditTreasuryModalOpen, feeSettings]);

  const handleCopyAddress = async (address: string) => {
    if (!isHydrated) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const formatDate = (timestamp: Timestamp | string) => {
    try {
      const date =
        typeof timestamp === "object" && "toDate" in timestamp
          ? (timestamp as Timestamp).toDate()
          : new Date(timestamp);

      if (!isValid(date)) return "Invalid date";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error("Error formatting date:", err);
      return "Invalid date";
    }
  };

  const handleSaveFeeShare = async () => {
    setFeeShareError(null);

    if (feeShare === "") {
      setFeeShareError("Please enter a fee share.");
      return;
    }

    const toastId = toast.loading("Updating platform fee share...");
    setIsSavingFeeShare(true);

    try {
      await updatePlatformFeeShare(Number(feeShare));
      toast.success("Platform fee share updated successfully!", {
        id: toastId,
      });
      setIsEditFeeShareModalOpen(false);
    } catch (err) {
      console.error("Failed to update fee share:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update fee share";
      setFeeShareError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSavingFeeShare(false);
    }
  };

  const handleSaveTreasury = async () => {
    setTreasuryError(null);

    if (!treasuryAddress) {
      setTreasuryError("Please enter a treasury address.");
      return;
    }

    const toastId = toast.loading("Updating treasury address...");
    setIsSavingTreasury(true);

    try {
      await updatePlatformTreasury(treasuryAddress);
      toast.success("Treasury address updated successfully!", { id: toastId });
      setIsEditTreasuryModalOpen(false);
    } catch (err) {
      console.error("Failed to update treasury address:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update treasury address";
      setTreasuryError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSavingTreasury(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Fee Management</h1>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-600">Loading fee settings...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Fee Management</h1>
          <button
            onClick={() => refetch()}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Retry
          </button>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm">
          <div className="p-6">
            <div className="bg-red-50/90 backdrop-blur-sm text-red-600 p-4 rounded-lg">
              Error loading fee settings:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-20 min-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <ArrowPathIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure platform fees and treasury settings
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Refresh
        </button>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-sm shadow-[0_0_10px_rgba(191,219,254,0.2)]">
        <div className="p-6">
          {feeSettings ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Platform Fee Share
                  </h3>
                  <p className="mt-1 text-2xl font-semibold">
                    {feeSettings?.platformFeeShare}
                    <span className="text-sm text-gray-500 ml-1">
                      basis points
                    </span>
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setIsEditFeeShareModalOpen(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Treasury Address
                </h3>
                <div className="mt-1 flex items-center justify-between">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddressPopover(!showAddressPopover);
                      }}
                      className="font-mono text-sm text-gray-600 hover:text-gray-800"
                    >
                      {feeSettings?.treasuryAddress
                        ? `${feeSettings.treasuryAddress.slice(
                            0,
                            6
                          )}...${feeSettings.treasuryAddress.slice(-4)}`
                        : "No address set"}
                    </button>

                    {showAddressPopover && feeSettings?.treasuryAddress && (
                      <div
                        ref={popoverRef}
                        className="absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-fit min-w-[300px]"
                      >
                        <div className="flex items-start gap-2">
                          <div className="font-mono text-sm break-all">
                            {feeSettings.treasuryAddress}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(feeSettings.treasuryAddress);
                            }}
                            className="flex-shrink-0 text-gray-500 hover:text-gray-700"
                            title="Copy Address"
                          >
                            {copiedAddress ? (
                              <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
                            ) : (
                              <ClipboardIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <a
                            href={`https://etherscan.io/address/${feeSettings.treasuryAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View on Etherscan
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditTreasuryModalOpen(true)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="pt-2 border-t border-gray-100"></div>

              <div className="space-y-3">
                {/* Last Operation */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Last Operation</span>
                  <span className="text-sm font-medium">
                    {feeSettings?.lastOperation}
                  </span>
                </div>

                {/* Last Updated */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Last Updated</span>
                  <span
                    className="text-sm font-medium text-gray-600"
                    title={feeSettings?.lastUpdated}
                  >
                    {feeSettings?.lastUpdated &&
                      formatDate(feeSettings.lastUpdated)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">
                No fee settings found
              </h3>
              <p className="text-gray-600 mb-6">
                Configure your platform's fee settings to get started!
              </p>
              <button
                onClick={() => setIsEditFeeShareModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
              >
                <PencilIcon className="h-5 w-5" />
                Configure Fees
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Fee Share Modal */}
      {isEditFeeShareModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-md"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 rounded-xl shadow-xl border border-gray-100 flex flex-col p-6">
              <h2 className="text-lg font-medium mb-4">
                Edit Platform Fee Share
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveFeeShare();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Platform Fee Share (basis points)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={feeShare}
                    onChange={(e) =>
                      setFeeShare(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter fee share in basis points"
                    required
                  />
                </div>
                {feeShareError && (
                  <div className="text-red-600 text-sm">{feeShareError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditFeeShareModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                    disabled={isSavingFeeShare}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingFeeShare || isUpdatingFeeShare}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    {isSavingFeeShare || isUpdatingFeeShare
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Edit Treasury Address Modal */}
      {isEditTreasuryModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-md"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 rounded-xl shadow-xl border border-gray-100 flex flex-col p-6">
              <h2 className="text-lg font-medium mb-4">
                Edit Treasury Address
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTreasury();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Treasury Address
                  </label>
                  <input
                    type="text"
                    value={treasuryAddress}
                    onChange={(e) => setTreasuryAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="0x..."
                    required
                  />
                </div>
                {treasuryError && (
                  <div className="text-red-600 text-sm">{treasuryError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditTreasuryModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                    disabled={isSavingTreasury}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTreasury || isUpdatingTreasury}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    {isSavingTreasury || isUpdatingTreasury
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
