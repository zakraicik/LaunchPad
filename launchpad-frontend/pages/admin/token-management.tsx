import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import {
  useTokenRegistry,
  useAddToken,
  useRemoveToken,
  useToggleTokenSupport,
  useUpdateMinContribution,
} from "@/hooks/tokenRegistry";
import { useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useAccount, useWriteContract, useChainId } from "wagmi";
import { useIsAdmin } from "../../utils/admin";
import toast from "react-hot-toast";
import { formatUnits } from "ethers";
import { useRouter } from "next/router";
import { useHydration } from "@/pages/_app";
import { formatDistanceToNow, isValid } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { XMarkIcon } from "@heroicons/react/24/outline";
import SpeedDialSimple from "../../components/SpeedDialSimple";

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  isSupported: boolean;
  minimumContribution: string;
  lastOperation: "TOKEN_ADDED" | "TOKEN_REMOVED" | string;
  lastUpdated: string | Timestamp;
  networkId: string;
}

export default function TokenManagement() {
  const router = useRouter();
  const { isHydrated } = useHydration();
  const { tokens, isLoading, error } = useTokenRegistry();
  const { address } = useAccount();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address);
  const { addToken, isAdding, error: addError } = useAddToken();
  const { removeToken, isRemoving, error: removeError } = useRemoveToken();
  const {
    toggleSupport,
    isToggling,
    error: toggleError,
  } = useToggleTokenSupport();
  const {
    updateMinContribution,
    isUpdating,
    error: updateError,
  } = useUpdateMinContribution();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const {
    writeContract,
    isPending,
    isError: writeContractError,
  } = useWriteContract();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [customSymbol, setCustomSymbol] = useState("");
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({});
  const [newTokenAddress, setNewTokenAddress] = useState("");
  const [minContribution, setMinContribution] = useState("");
  const [addTokenError, setAddTokenError] = useState<string | null>(null);
  const [tokenToRemove, setTokenToRemove] = useState<TokenInfo | null>(null);
  const [showAddressPopover, setShowAddressPopover] = useState<string | null>(
    null
  );
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hasFetchedSymbols = useRef(false);
  const chainId = useChainId();
  const [togglingTokenAddress, setTogglingTokenAddress] = useState<
    string | null
  >(null);
  const [isMinAmountModalOpen, setIsMinAmountModalOpen] = useState(false);
  const [selectedTokenForMinAmount, setSelectedTokenForMinAmount] =
    useState<TokenInfo | null>(null);
  const [newMinAmount, setNewMinAmount] = useState("");
  const [editingToken, setEditingToken] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isHydrated) return; // Skip if not hydrated yet

    if (!isLoadingAdmin && !isAdmin) {
      router.push("/");
      toast.error("You do not have permission to access this page");
    }
  }, [isAdmin, isLoadingAdmin, router, isHydrated]);

  // Click outside handler for popover
  useEffect(() => {
    if (!isHydrated) return; // Skip if not hydrated yet

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowAddressPopover(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHydrated]);

  // Fetch custom symbols
  useEffect(() => {
    if (!isHydrated) return; // Skip if not hydrated yet
    if (!tokens || hasFetchedSymbols.current) return;

    const fetchCustomSymbols = async () => {
      try {
        const symbols: Record<string, string> = {};
        for (const token of tokens) {
          const tokenRef = doc(
            collection(db, "tokens"),
            token.address.toLowerCase()
          );
          const tokenDoc = await getDoc(tokenRef);
          if (tokenDoc.exists() && tokenDoc.data().symbol) {
            symbols[token.address.toLowerCase()] = tokenDoc.data().symbol;
          }
        }
        setTokenSymbols(symbols);
        hasFetchedSymbols.current = true;
      } catch (error) {
        console.error("Error fetching custom symbols:", error);
      }
    };

    fetchCustomSymbols();
  }, [tokens, isHydrated]);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleEditClick = (token: TokenInfo) => {
    if (!isAdmin) return;
    setSelectedToken(token);
    setCustomSymbol(
      tokenSymbols[token.address.toLowerCase()] ||
        token.symbol ||
        `${token.address.slice(0, 6)}...${token.address.slice(-4)}`
    );
    setIsEditModalOpen(true);
  };

  const handleSaveSymbol = async () => {
    if (!selectedToken || !isAdmin) return;

    try {
      const tokenRef = doc(
        collection(db, "tokens"),
        selectedToken.address.toLowerCase()
      );
      await setDoc(
        tokenRef,
        {
          symbol: customSymbol,
        },
        { merge: true }
      );

      // Update local state
      setTokenSymbols((prev) => ({
        ...prev,
        [selectedToken.address.toLowerCase()]: customSymbol,
      }));

      setIsEditModalOpen(false);
      setSelectedToken(null);
      setCustomSymbol("");
    } catch (error) {
      console.error("Error saving symbol:", error);
    }
  };

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHydrated) return;

    const toastId = toast.loading("Adding token...");
    try {
      await addToken(newTokenAddress, minContribution);
      toast.success("Token added successfully!", { id: toastId });
      setIsAddModalOpen(false);
      setNewTokenAddress("");
      setMinContribution("");
    } catch (err) {
      console.error("Failed to add token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add token";
      setAddTokenError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleRemoveClick = (token: TokenInfo) => {
    if (!isAdmin) return;
    setTokenToRemove(token);
    setIsRemoveModalOpen(true);
  };

  const handleRemoveToken = async (tokenAddress: string) => {
    if (!isHydrated) return;

    const toastId = toast.loading("Removing token...");
    try {
      await removeToken(tokenAddress);
      setIsRemoveModalOpen(false);
      setTokenToRemove(null);
      toast.success("Token removed successfully!", { id: toastId });
    } catch (err) {
      console.error("Failed to remove token:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove token";
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleToggleSupport = async (token: TokenInfo) => {
    if (!isAdmin) return;

    setTogglingTokenAddress(token.address);
    const toastId = toast.loading(
      `${token.isSupported ? "Disabling" : "Enabling"} token support...`
    );

    try {
      await toggleSupport(token.address, !token.isSupported);
      toast.success(
        `Token support ${
          token.isSupported ? "disabled" : "enabled"
        } successfully!`,
        { id: toastId }
      );
    } catch (error) {
      console.error("Error toggling token support:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to toggle token support";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setTogglingTokenAddress(null);
    }
  };

  const handleEditMinAmount = (token: TokenInfo) => {
    if (!isAdmin) return;
    setSelectedTokenForMinAmount(token);
    // Convert WEI to whole tokens using the token's decimals
    const wholeTokens = formatUnits(token.minimumContribution, token.decimals);
    setNewMinAmount(wholeTokens);
    setIsMinAmountModalOpen(true);
  };

  const handleUpdateMinAmount = async () => {
    if (!selectedTokenForMinAmount || !isAdmin || !newMinAmount) return;

    const toastId = toast.loading("Updating minimum contribution...");
    try {
      await updateMinContribution(
        selectedTokenForMinAmount.address,
        newMinAmount.toString()
      );
      toast.success("Minimum contribution updated successfully!", {
        id: toastId,
      });
      setIsMinAmountModalOpen(false);
      setSelectedTokenForMinAmount(null);
      setNewMinAmount("");
    } catch (error) {
      console.error("Error updating minimum contribution:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update minimum contribution";
      toast.error(errorMessage, { id: toastId });
    }
  };

  // Helper function to format the date properly
  const formatLastUpdated = (lastUpdated: string | Timestamp | unknown) => {
    // Handle Firestore Timestamp objects
    if (
      lastUpdated &&
      typeof lastUpdated === "object" &&
      "toDate" in lastUpdated
    ) {
      try {
        // @ts-ignore - We've already checked it has toDate
        const date = lastUpdated.toDate();
        if (isValid(date)) {
          return `${formatDistanceToNow(date)} ago`;
        }
      } catch (error) {
        console.error("Error formatting Timestamp:", error);
      }
    }

    // Handle date strings
    if (lastUpdated && typeof lastUpdated === "string") {
      try {
        const date = new Date(lastUpdated);
        if (isValid(date)) {
          return `${formatDistanceToNow(date)} ago`;
        }
      } catch (error) {
        console.error("Error formatting date string:", error);
      }

      // Try as numeric timestamp
      try {
        const timestamp = Number(lastUpdated);
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
          if (isValid(date)) {
            return `${formatDistanceToNow(date)} ago`;
          }
        }
      } catch (error) {
        console.error("Error formatting numeric timestamp:", error);
      }
    }

    return "Just now";
  };

  if (!isHydrated || isLoadingAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    router.push("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Token Management</h1>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-600">Loading tokens...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Token Management</h1>
        </div>
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              Error loading tokens:{" "}
              {typeof error === "string" ? error : "Unknown error"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-20 min-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Token Management</h1>
      </div>

      {/* Card Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tokens?.map((token) => (
          <div
            key={token.address}
            className="bg-white/10 backdrop-blur-md rounded-lg shadow p-4 space-y-4 shadow-[0_0_10px_rgba(191,219,254,0.2)]"
          >
            {/* Header with symbol and remove button */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {tokenSymbols[token.address.toLowerCase()] ||
                      token.symbol ||
                      `${token.address.slice(0, 6)}...${token.address.slice(
                        -4
                      )}`}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleEditClick(token)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit Symbol"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowAddressPopover(
                        showAddressPopover === token.address
                          ? null
                          : token.address
                      )
                    }
                    className="font-mono text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </button>
                  {showAddressPopover === token.address && (
                    <div
                      ref={popoverRef}
                      className="absolute left-1/2 -translate-x-1/2 mt-2 w-[calc(100vw-2rem)] md:w-80 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                    >
                      <div className="p-3 md:p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs md:text-sm font-medium text-gray-900">
                            Token Address
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(token.address);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {copiedAddress === token.address ? (
                              <ClipboardDocumentCheckIcon className="h-4 md:h-5 w-4 md:w-5 text-green-500" />
                            ) : (
                              <ClipboardIcon className="h-4 md:h-5 w-4 md:w-5" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs md:text-sm font-mono mb-2 text-gray-600 break-all">
                          {token.address}
                        </p>
                        <a
                          href={`${
                            chainId === 8453
                              ? "https://basescan.org/address/"
                              : chainId === 84531
                              ? "https://goerli.basescan.org/address/"
                              : "https://basescan.org/address/"
                          }${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs md:text-sm text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on Basescan →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleRemoveClick(token)}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  disabled={!isAdmin}
                  title="Remove Token"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Token settings section */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              {/* Support Status */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Support Status</span>
                <button
                  onClick={() => isAdmin && handleToggleSupport(token)}
                  disabled={
                    (isToggling && togglingTokenAddress === token.address) ||
                    !isAdmin
                  }
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    token.isSupported ? "bg-green-600" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={token.isSupported}
                  title={
                    isAdmin
                      ? token.isSupported
                        ? "Disable Support"
                        : "Enable Support"
                      : "Only admins can change token support"
                  }
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      token.isSupported ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Minimum Contribution */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-500">
                    Minimum Contribution
                  </span>
                  <div className="text-sm text-gray-900 font-medium">
                    {formatUnits(token.minimumContribution, token.decimals)}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleEditMinAmount(token)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit Minimum Contribution"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="pt-1 border-t border-gray-100"></div>

              {/* Last Operation */}
              {token.lastOperation && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Last Operation</span>
                  <span className="text-sm font-medium">
                    {token.lastOperation}
                  </span>
                </div>
              )}

              {/* Last Updated */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span
                  className="text-sm font-medium text-gray-600"
                  title={String(token.lastUpdated)}
                >
                  {formatLastUpdated(token.lastUpdated)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {tokens?.length === 0 && (
          <div className="col-span-full text-center py-12">
            <h3 className="text-xl font-semibold mb-4">No tokens found</h3>
            <p className="text-gray-600 mb-6">
              Add your first token to get started!
            </p>
          </div>
        )}
      </div>

      {/* SpeedDial */}
      {isHydrated && (
        <div className="fixed bottom-8 right-8 z-[100]">
          <SpeedDialSimple
            mainAction={{
              icon: <PlusIcon className="h-8 w-8" />,
              label: "Add Token",
              onClick: () => setIsAddModalOpen(true),
              disabled: !isAdmin,
              disabledTooltip: "Only admins can add tokens",
            }}
            variant="purple"
          />
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-white/30 backdrop-blur-md"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 flex flex-col p-6">
              <h2 className="text-lg font-medium mb-4">Edit Token Symbol</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbol
                </label>
                <input
                  type="text"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter symbol"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSymbol}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Token Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-white/20 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)]"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-[0_0_10px_rgba(191,219,254,0.2)] flex flex-col border border-gray-200">
              <div className="h-1 w-full bg-white/20 rounded-t-xl">
                <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 rounded-t-xl" />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="flex items-center text-lg font-semibold bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                    <PlusIcon className="w-6 h-6 mr-2 text-blue-400" />
                    <span>Add New Token</span>
                  </h3>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleAddToken} className="space-y-6">
                  <div>
                    <div className="text-sm text-gray-500 mb-4">
                      Enter the token address and minimum contribution amount.
                      Make sure the token is supported on the current network.
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="tokenAddress"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Token Address
                        </label>
                        <input
                          type="text"
                          id="tokenAddress"
                          value={newTokenAddress}
                          onChange={(e) => setNewTokenAddress(e.target.value)}
                          className="w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                          placeholder="0x..."
                          required
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="minContribution"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Minimum Contribution
                        </label>
                        <input
                          type="text"
                          id="minContribution"
                          value={minContribution}
                          onChange={(e) => setMinContribution(e.target.value)}
                          className="w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                          placeholder="0.1"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  {addError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
                      {addError}
                    </div>
                  )}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-md hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 border border-gray-200 rounded-md transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAdding}
                      className="relative overflow-hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 group"
                    >
                      {!isAdding && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/60 to-primary-400/0 animate-shimmer pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/40 to-primary-400/0 animate-shimmer [animation-delay:1s] pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/30 to-primary-400/0 animate-shimmer [animation-delay:2s] pointer-events-none" />
                        </>
                      )}
                      {isAdding ? "Adding..." : "Add Token"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Token Modal */}
      {isRemoveModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-white/30 backdrop-blur-md"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 flex flex-col p-6">
              <h2 className="text-lg font-medium mb-4">Remove Token</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to remove {tokenToRemove?.symbol}? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsRemoveModalOpen(false);
                    setTokenToRemove(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleRemoveToken(tokenToRemove?.address || "")
                  }
                  disabled={isRemoving}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {isRemoving ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Min Amount Modal */}
      {isMinAmountModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-white/20 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)]"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-[0_0_10px_rgba(191,219,254,0.2)] flex flex-col border border-gray-200">
              <div className="h-1 w-full bg-white/20 rounded-t-xl">
                <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 rounded-t-xl" />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="flex items-center text-lg font-semibold bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                    <PencilIcon className="w-6 h-6 mr-2 text-blue-400" />
                    <span>Edit Minimum Contribution</span>
                  </h3>
                  <button
                    onClick={() => {
                      setIsMinAmountModalOpen(false);
                      setSelectedTokenForMinAmount(null);
                      setNewMinAmount("");
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="text-sm text-gray-500 mb-4">
                      Update the minimum contribution amount for{" "}
                      {selectedTokenForMinAmount?.symbol || "this token"}. This
                      will affect all future contributions.
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Contribution (in{" "}
                        {selectedTokenForMinAmount?.symbol || "tokens"})
                      </label>
                      <input
                        type="number"
                        value={newMinAmount}
                        onChange={(e) => setNewMinAmount(e.target.value)}
                        className="w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                        placeholder="Enter minimum contribution amount"
                        min="0"
                        step="0.000000000000000001"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setIsMinAmountModalOpen(false);
                        setSelectedTokenForMinAmount(null);
                        setNewMinAmount("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-md hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 border border-gray-200 rounded-md transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateMinAmount}
                      disabled={isUpdating || !newMinAmount}
                      className="relative overflow-hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 group"
                    >
                      {!isUpdating && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/60 to-primary-400/0 animate-shimmer pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/40 to-primary-400/0 animate-shimmer [animation-delay:1s] pointer-events-none" />
                          <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/30 to-primary-400/0 animate-shimmer [animation-delay:2s] pointer-events-none" />
                        </>
                      )}
                      {isUpdating ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
