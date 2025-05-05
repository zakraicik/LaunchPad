const pulseAnimation = `
@keyframes pulse-blue {
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

@keyframes pulse-purple {
  0% {
    box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(147, 51, 234, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(147, 51, 234, 0);
  }
}

.pulse-blue {
  animation: pulse-blue 2s infinite;
}

.pulse-purple {
  animation: pulse-purple 2s infinite;
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
  variant?: "blue" | "purple";
}

export default function SpeedDialSimple({
  mainAction,
  variant = "blue",
}: SpeedDialProps) {
  const baseColors =
    variant === "purple"
      ? "bg-purple-600 hover:bg-purple-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <>
      <style>{pulseAnimation}</style>
      <div className="fixed bottom-8 right-8 z-[100]">
        <button
          onClick={mainAction.onClick}
          disabled={mainAction.disabled}
          className={`${baseColors} text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative group pulse-${variant}`}
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
