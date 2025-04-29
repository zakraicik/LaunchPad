import { Fragment, useState, useEffect, useRef } from "react";

// Update animation classes
const pulseAnimation = `
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
  }
}

.pulse {
  animation: pulse 2s infinite;
}
`;

interface SpeedDialProps {
  mainAction: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    disabledTooltip?: string;
  };
}

export default function SpeedDialSimple({ mainAction }: SpeedDialProps) {
  return (
    <>
      <style>{pulseAnimation}</style>
      <div className="fixed bottom-6 right-6 z-20">
        <button
          onClick={mainAction.onClick}
          disabled={mainAction.disabled}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative group"
          title={
            mainAction.disabled ? mainAction.disabledTooltip : mainAction.label
          }
        >
          {mainAction.icon}
          {mainAction.disabled && mainAction.disabledTooltip && (
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {mainAction.disabledTooltip}
            </div>
          )}
        </button>
      </div>
    </>
  );
}
