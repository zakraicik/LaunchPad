import { useState } from "react";

export function ContractAddress({ address }: { address: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);

  // Truncate: 0x1234...abcd
  const truncated = address.slice(0, 6) + "..." + address.slice(-4);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // fallback or error handling
    }
  };

  return (
    <span
      className="font-mono relative cursor-pointer select-text"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip((v) => !v)}
    >
      {truncated}
      {showTooltip && (
        <span className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap max-w-xs break-all flex flex-col items-center gap-1">
          {address}
          <button
            onClick={handleCopy}
            className="mt-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs focus:outline-none"
            type="button"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </span>
      )}
    </span>
  );
}
