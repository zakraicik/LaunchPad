import { useFeeManager } from "@/hooks/feeManagement/useFeeManager";
import { useTokenRegistry } from "@/hooks/tokenRegistry";
import { formatUnits } from "ethers";
import { useHydration } from "@/pages/_app";
import { formatDistanceToNow, isValid } from "date-fns";
import { useState, useRef } from "react";
import {
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";

function formatDate(ts: any) {
  if (!ts) return "";
  if (typeof ts === "object" && "seconds" in ts && "nanoseconds" in ts) {
    const date = new Date(ts.seconds * 1000);
    if (isValid(date)) return formatDistanceToNow(date, { addSuffix: true });
    return date.toLocaleString();
  }
  if (typeof ts === "string") {
    const date = new Date(ts);
    if (!isNaN(date.getTime()))
      return formatDistanceToNow(date, { addSuffix: true });
    return ts;
  }
  return String(ts);
}

export default function PlatformSettings() {
  const { isHydrated } = useHydration();
  const { feeSettings, isLoading: isLoadingFee } = useFeeManager();
  const { tokens, isLoading: isLoadingTokens } = useTokenRegistry();
  const [showAddressTooltip, setShowAddressTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  // For token tooltips/copy
  const [openTokenTooltip, setOpenTokenTooltip] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Optionally handle error
    }
  };

  const handleCopyTokenAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedToken(address);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {}
  };

  if (!isHydrated || isLoadingFee || isLoadingTokens) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-20 min-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Platform Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              View platform fees, treasury, and supported tokens
            </p>
          </div>
        </div>
      </div>

      {/* Responsive container for Fee Settings and Supported Tokens */}
      <div className="flex flex-col gap-8 md:flex-row md:gap-8 md:items-stretch">
        <div className="flex-1 bg-white/20 backdrop-blur-md rounded-lg shadow-sm shadow-[0_0_10px_rgba(191,219,254,0.2)]">
          <div className="p-6 h-full flex flex-col">
            {feeSettings ? (
              <div className="space-y-6 flex-1 flex flex-col justify-center">
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
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Treasury Address
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <div
                      className="font-mono text-sm text-gray-600 relative cursor-pointer"
                      ref={addressRef}
                      onMouseEnter={() => setShowAddressTooltip(true)}
                      onMouseLeave={() => setShowAddressTooltip(false)}
                    >
                      {feeSettings?.treasuryAddress
                        ? `${feeSettings.treasuryAddress.slice(
                            0,
                            6
                          )}...${feeSettings.treasuryAddress.slice(-4)}`
                        : "No address set"}
                      {showAddressTooltip && feeSettings?.treasuryAddress && (
                        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-fit min-w-[200px] rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 p-3">
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs break-all text-gray-900">
                                {feeSettings.treasuryAddress}
                              </span>
                              <button
                                onClick={() =>
                                  handleCopyAddress(feeSettings.treasuryAddress)
                                }
                                className="flex-shrink-0 text-gray-500 hover:text-gray-700"
                                title="Copy Address"
                              >
                                {copied ? (
                                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
                                ) : (
                                  <ClipboardIcon className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                            <a
                              href={`https://basescan.org/address/${feeSettings.treasuryAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              View on BaseScan
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="pt-2 border-t border-gray-100"></div>

                <div className="space-y-3">
                  {/* Last Operation */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      Last Operation
                    </span>
                    <span className="text-sm font-medium">
                      {feeSettings?.lastOperation}
                    </span>
                  </div>

                  {/* Last Updated */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Last Updated</span>
                    <span
                      className="text-sm font-medium text-gray-600"
                      title={String(feeSettings?.lastUpdated)}
                    >
                      {feeSettings?.lastUpdated &&
                        formatDate(feeSettings.lastUpdated)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 flex-1 flex flex-col justify-center">
                <h3 className="text-xl font-semibold mb-4">
                  No fee settings found
                </h3>
                <p className="text-gray-600 mb-6">
                  Platform fee settings are not yet configured.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Supported Tokens */}
        <div className="flex-1 bg-white/20 backdrop-blur-md rounded-lg shadow-sm p-6 mt-8 md:mt-0">
          <h2 className="text-lg font-semibold mb-4">Supported Tokens</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">Symbol</th>
                <th className="text-left py-2">Address</th>
                <th className="text-left py-2">Min Contribution</th>
              </tr>
            </thead>
            <tbody>
              {tokens
                ?.filter((token) => token.isSupported)
                .map((token) => (
                  <tr key={token.address}>
                    <td className="py-2">{token.symbol}</td>
                    <td className="py-2 font-mono">
                      <div
                        className="inline-block relative cursor-pointer"
                        onMouseEnter={() => setOpenTokenTooltip(token.address)}
                        onMouseLeave={() => setOpenTokenTooltip(null)}
                      >
                        {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        {openTokenTooltip === token.address && (
                          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-fit min-w-[200px] rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 p-3">
                            <div className="flex flex-col items-start gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs break-all text-gray-900">
                                  {token.address}
                                </span>
                                <button
                                  onClick={() =>
                                    handleCopyTokenAddress(token.address)
                                  }
                                  className="flex-shrink-0 text-gray-500 hover:text-gray-700"
                                  title="Copy Address"
                                >
                                  {copiedToken === token.address ? (
                                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <ClipboardIcon className="h-5 w-5" />
                                  )}
                                </button>
                              </div>
                              <a
                                href={`https://basescan.org/address/${token.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                View on BaseScan
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      {formatUnits(token.minimumContribution, token.decimals)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
