import { Fragment, useState, useEffect, useRef } from "react";
import {
  RocketLaunchIcon,
  BanknotesIcon,
  ShareIcon,
  TrashIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

// Update animation classes
const pulseAnimation = `
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}

@keyframes pulse-red {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(220, 38, 38, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
  }
}

.pulse {
  animation: pulse 2s infinite;
}

.pulse-red {
  animation: pulse-red 2s infinite;
}
`;

interface SpeedDialAction {
  icon: React.ReactNode;
  name: string;
  onClick: () => void;
  disabled?: boolean;
  show?: boolean;
  tooltip?: string;
}

interface SpeedDialProps {
  canContribute: boolean;
  canRequestRefund: boolean;
  canClaimFunds: boolean;
  onContribute: () => void;
  onRequestRefund: () => void;
  onClaimFunds: () => void;
  onShare: () => void;
  isContributing?: boolean;
  isRequestingRefund?: boolean;
  isClaiming?: boolean;
  isRefundWaitingForOwnerClaim?: boolean;
  // Admin props
  isAdmin?: boolean;
  isAuthorized?: boolean;
  isDeauthorizing?: boolean;
  adminOverrideEnabled?: boolean;
  isSettingOverride?: boolean;
  onDeauthorize?: () => void;
  onToggleOverride?: () => void;
}

export default function SpeedDial({
  canContribute,
  canRequestRefund,
  canClaimFunds,
  onContribute,
  onRequestRefund,
  onClaimFunds,
  onShare,
  isContributing,
  isRequestingRefund,
  isClaiming,
  isRefundWaitingForOwnerClaim,
  // Admin props
  isAdmin,
  isAuthorized,
  isDeauthorizing,
  adminOverrideEnabled,
  isSettingOverride,
  onDeauthorize,
  onToggleOverride,
}: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const speedDialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        speedDialRef.current &&
        !speedDialRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const actions: SpeedDialAction[] = [
    {
      icon: <ShareIcon className="h-5 w-5" />,
      name: "Share Campaign",
      onClick: () => {
        onShare();
        setIsOpen(false);
      },
      show: true,
    },
    {
      icon: <RocketLaunchIcon className="h-5 w-5" />,
      name: "Contribute",
      onClick: () => {
        onContribute();
        setIsOpen(false);
      },
      disabled: isContributing || !canContribute,
      show: canContribute,
    },
    {
      icon: <BanknotesIcon className="h-5 w-5" />,
      name: "Request Refund",
      onClick: () => {
        onRequestRefund();
        setIsOpen(false);
      },
      disabled:
        isRequestingRefund || !canRequestRefund || isRefundWaitingForOwnerClaim,
      show: canRequestRefund,
      tooltip: isRefundWaitingForOwnerClaim
        ? "Waiting for campaign owner to claim funds"
        : undefined,
    },
    {
      icon: <BanknotesIcon className="h-5 w-5" />,
      name: "Claim Funds",
      onClick: () => {
        onClaimFunds();
        setIsOpen(false);
      },
      disabled: isClaiming || !canClaimFunds,
      show: canClaimFunds,
    },
    // Admin actions
    ...(isAdmin && isAuthorized
      ? [
          {
            icon: <TrashIcon className="h-5 w-5" />,
            name: "Terminate Campaign",
            onClick: () => {
              onDeauthorize?.();
              setIsOpen(false);
            },
            disabled: isDeauthorizing,
            show: true,
          },
          {
            icon: <ShieldCheckIcon className="h-5 w-5" />,
            name: adminOverrideEnabled ? "Disable Override" : "Enable Override",
            onClick: () => {
              onToggleOverride?.();
              setIsOpen(false);
            },
            disabled: isSettingOverride,
            show: true,
          },
        ]
      : []),
  ].filter((action) => action.show);

  return (
    <>
      <style>{pulseAnimation}</style>

      <div className="fixed bottom-8 right-8 z-50" ref={speedDialRef}>
        <div className="relative">
          {/* Speed Dial Actions */}
          <div
            className={`absolute bottom-full right-0 mb-4 space-y-2 transition-all duration-300 ${
              isOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            }`}
          >
            {actions.map((action, index) => {
              const isAdminAction =
                action.name === "Terminate Campaign" ||
                action.name.includes("Override");
              return (
                <button
                  key={action.name}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  style={{
                    transitionDelay: isOpen ? `${index * 75}ms` : "0ms",
                    transform: `translateY(${isOpen ? 0 : 10}px)`,
                    opacity: isOpen ? 1 : 0,
                  }}
                  className={`group flex items-center justify-between gap-2 bg-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 ${
                    action.disabled
                      ? "opacity-50 cursor-not-allowed hover:bg-white"
                      : "hover:bg-gray-50"
                  } ${
                    isAdminAction
                      ? "text-purple-600 hover:text-purple-700"
                      : action.name === "Request Refund"
                      ? action.disabled
                        ? "text-gray-500"
                        : "text-red-600 hover:text-red-700"
                      : "text-blue-600 hover:text-blue-700"
                  }`}
                >
                  <span className="text-sm font-medium whitespace-nowrap">
                    {action.name}
                  </span>
                  <div
                    className={
                      isAdminAction
                        ? "text-purple-600"
                        : action.name === "Request Refund"
                        ? action.disabled
                          ? "text-gray-500"
                          : "text-red-600"
                        : "text-blue-600"
                    }
                  >
                    {action.icon}
                  </div>
                  {action.tooltip && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      {action.tooltip}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Main Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-4 rounded-full shadow-lg transition-all duration-300 ${
              !isOpen ? (canRequestRefund ? "pulse-red" : "pulse") : ""
            } ${
              isOpen
                ? "bg-gray-800 text-white scale-110"
                : canRequestRefund
                ? "bg-red-600 text-white hover:bg-red-700 hover:scale-105"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
            }`}
          >
            <RocketLaunchIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </>
  );
}
