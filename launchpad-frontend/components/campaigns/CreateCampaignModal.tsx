import { useState, useRef, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { useCampaignFactory } from "../../hooks/useCampaignFactory";
import { useTokenRegistry } from "../../hooks/tokenRegistry";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilSquareIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
  PhotoIcon,
  RocketLaunchIcon,
  FingerPrintIcon,
  BuildingLibraryIcon,
  GlobeAmericasIcon,
  SunIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { useHydration } from "../../pages/_app";
import { addDays } from "date-fns";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  isSupported: boolean;
  minimumContribution: string;
}

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const categories = [
  "DeFi",
  "Infrastructure",
  "DAOs",
  "NFTs",
  "Gaming",
  "Identity",
  "RWA",
  "Public Goods",
  "Climate",
  "Enterprise",
];

const steps = [
  { id: "title", label: "Project Name" },
  { id: "description", label: "Project Description" },
  { id: "duration", label: "Campaign End Date" },
  { id: "token", label: "Token" },
  { id: "targetAmount", label: "Target Amount" },
  { id: "category", label: "Category" },
  { id: "githubUrl", label: "GitHub Repository" },
];

const categoryOptions = [
  {
    name: "DeFi",
    icon: CurrencyDollarIcon,
    description:
      "Lending protocols, DEXs, yield optimization, insurance protocols",
    textColor: "text-blue-600",
  },
  {
    name: "Infrastructure",
    icon: WrenchScrewdriverIcon,
    description:
      "Layer 1/2 solutions, developer tools, oracles, security solutions",
    textColor: "text-blue-600",
  },
  {
    name: "DAOs",
    icon: UserGroupIcon,
    description:
      "Community organizations, protocol governance, investment DAOs, coordination tools",
    textColor: "text-blue-600",
  },
  {
    name: "NFTs",
    icon: PhotoIcon,
    description:
      "Marketplaces, creator platforms, metaverse assets, gaming assets",
    textColor: "text-blue-600",
  },
  {
    name: "Gaming",
    icon: RocketLaunchIcon,
    description:
      "Play-to-earn, virtual worlds, gaming guilds, gaming infrastructure",
    textColor: "text-blue-600",
  },
  {
    name: "Identity",
    icon: FingerPrintIcon,
    description:
      "Decentralized identity, social platforms, reputation systems, privacy tools",
    textColor: "text-blue-600",
  },
  {
    name: "RWA",
    icon: BuildingLibraryIcon,
    description:
      "Tokenized real estate, carbon credits, commodities, securities",
    textColor: "text-blue-600",
  },
  {
    name: "Public Goods",
    icon: GlobeAmericasIcon,
    description:
      "Protocol research, open-source infrastructure, education initiatives",
    textColor: "text-blue-600",
  },
  {
    name: "Climate",
    icon: SunIcon,
    description:
      "Regenerative finance (ReFi), climate tech, impact measurement, green crypto",
    textColor: "text-blue-600",
  },
  {
    name: "Enterprise",
    icon: BuildingOfficeIcon,
    description: "Enterprise and institutional blockchain solutions",
    textColor: "text-blue-600",
  },
];

export default function CreateCampaignModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCampaignModalProps) {
  const { isHydrated } = useHydration();
  const { address, isConnected } = useAccount();
  const { createCampaign } = useCampaignFactory();
  const { tokens, isLoading: isLoadingTokens } = useTokenRegistry();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    targetAmount: "",
    token: "",
    duration: "",
    category: "",
    githubUrl: "",
    endDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    [key: string]: string | null;
  }>({});

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData({
        title: "",
        description: "",
        targetAmount: "",
        token: "",
        duration: "",
        category: "",
        githubUrl: "",
        endDate: "",
      });
      setFieldErrors({});
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleInputChange = (field: string, value: string) => {
    if (field === "endDate") {
      const today = new Date();
      const selectedDate = new Date(value);
      const diffTime =
        selectedDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setFormData((prev) => ({
        ...prev,
        endDate: value,
        duration: diffDays > 0 ? String(diffDays) : "",
      }));
      if (value) {
        setFieldErrors((prev) => ({ ...prev, endDate: null, duration: null }));
      }
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (value.trim() !== "") {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateStep = () => {
    const currentField = steps[currentStep].id;
    const value = formData[currentField as keyof typeof formData];
    let errorMsg: string | null = null;

    if (!value || (typeof value === "string" && value.trim() === "")) {
      errorMsg = `Please fill in the ${steps[currentStep].label}`;
      setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
      setError(null);
      return false;
    }

    if (currentField === "description") {
      if (value.length > 1250) {
        errorMsg = "Description must be 1250 characters or less.";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
    }

    if (currentField === "token") {
      if (!value) {
        errorMsg = "Please select a token.";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
    }

    if (currentField === "targetAmount") {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        errorMsg =
          "Please enter a valid positive number for the target amount.";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
    }

    if (currentField === "duration") {
      const endDate = formData.endDate;
      if (!endDate) {
        errorMsg = "Please select an end date.";
        setFieldErrors((prev) => ({
          ...prev,
          endDate: errorMsg,
          duration: errorMsg,
        }));
        setError(null);
        return false;
      }
      const today = new Date();
      const selectedDate = new Date(endDate);
      const maxDate = addDays(today, 365);
      if (selectedDate <= today) {
        errorMsg = "End date must be after today.";
        setFieldErrors((prev) => ({
          ...prev,
          endDate: errorMsg,
          duration: errorMsg,
        }));
        setError(null);
        return false;
      }
      if (selectedDate > maxDate) {
        errorMsg = "End date must be within 1 year from today.";
        setFieldErrors((prev) => ({
          ...prev,
          endDate: errorMsg,
          duration: errorMsg,
        }));
        setError(null);
        return false;
      }
    }

    if (currentField === "category") {
      if (!value) {
        errorMsg = "Please select a category.";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
    }

    if (currentField === "githubUrl") {
      const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
      if (!value.includes("github.com")) {
        errorMsg = "The URL must contain github.com";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
      if (!githubUrlPattern.test(value)) {
        errorMsg = "Please enter a valid GitHub repository URL";
        setFieldErrors((prev) => ({ ...prev, [currentField]: errorMsg }));
        setError(null);
        return false;
      }
    }

    setFieldErrors((prev) => ({ ...prev, [currentField]: null }));
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHydrated) return;

    if (!isConnected) {
      setError("Please connect your wallet");
      return;
    }

    if (!validateStep()) return;

    const toastId = toast.loading("Creating your campaign...");
    setIsSubmitting(true);

    try {
      toast.loading("Deploying campaign contract...", { id: toastId });
      await createCampaign(
        formData.title,
        formData.description,
        formData.targetAmount,
        formData.token,
        formData.duration,
        formData.category,
        formData.githubUrl
      );

      toast.success("Campaign created successfully!", { id: toastId });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Error creating campaign:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create campaign";
      setError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    const step = steps[currentStep];
    const value = formData[step.id as keyof typeof formData];
    const errorMsg = fieldErrors[step.id];

    switch (step.id) {
      case "title":
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Name your future unicorn! This is what the crypto community will
              rally behind.
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(step.id, e.target.value)}
              className={`w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all ${
                errorMsg ? "border-red-500" : "border-gray-200"
              }`}
              placeholder="Enter your project name"
              maxLength={60}
            />
            <div className="text-right text-xs text-gray-400">
              {value.length}/60
            </div>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      case "description":
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Paint the vision behind your project. What problem are you solving
              in the web3 space? Share your technical approach, key milestones,
              and why your team is uniquely positioned to build this.
              Remember—transparency and technical depth win trust in crypto.
            </div>
            <textarea
              value={value}
              onChange={(e) => handleInputChange(step.id, e.target.value)}
              rows={4}
              maxLength={1250}
              className={`w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all ${
                errorMsg ? "border-red-500" : "border-gray-200"
              }`}
              placeholder="Describe your campaign"
            />
            <div className="text-right text-xs text-gray-400">
              {value.length}/1250
            </div>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      case "duration":
        const durationErrorMsg = fieldErrors.duration;
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Choose a timeline that creates momentum without rushing
              development. Campaigns can run for up to 1 year.
            </div>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="End Date"
                value={formData.endDate ? dayjs(formData.endDate) : null}
                minDate={dayjs()}
                maxDate={dayjs().add(365, "day")}
                onChange={(date) => {
                  if (date) {
                    handleInputChange("endDate", date.format("YYYY-MM-DD"));
                  } else {
                    handleInputChange("endDate", "");
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!durationErrorMsg,
                    helperText: durationErrorMsg || "",
                    sx: { mt: 0 },
                  },
                }}
              />
            </LocalizationProvider>
            <div className="text-xs text-gray-500">
              {formData.duration && Number(formData.duration) > 0 ? (
                `Campaign will run for ${formData.duration} day${
                  formData.duration === "1" ? "" : "s"
                }.`
              ) : (
                <>{"\u00A0"}</>
              )}
            </div>
          </div>
        );
      case "token":
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Select the token(s) you'll accept for contributions. Consider your
              project's ecosystem alignment and liquidity needs. If your token
              is not listed,{" "}
              <a
                href="mailto:hi@getlaunched.xyz"
                className="text-blue-600 underline hover:text-blue-800"
              >
                let us know.
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {tokens.map((token) => {
                const isSelected = formData.token === token.address;
                return (
                  <Button
                    key={token.address}
                    onClick={() =>
                      handleInputChange(
                        "token",
                        isSelected ? "" : token.address
                      )
                    }
                    variant={isSelected ? "contained" : "outlined"}
                    sx={{
                      textTransform: "none",
                      fontWeight: 500,
                      justifyContent: "center",
                      minWidth: 0,
                      width: "100%",
                      m: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    disableElevation
                    disableRipple
                  >
                    {token.symbol || token.address}
                  </Button>
                );
              })}
            </div>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      case "targetAmount":
        const selectedTokenObj = tokens.find(
          (t) => t.address === formData.token
        );
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Set a funding goal that aligns with your development roadmap.
              Consider your immediate needs for MVP development and initial
              marketing. Most successful projects set realistic initial targets
              that demonstrate resource efficiency.
            </div>
            <div className="relative w-full">
              <input
                type="number"
                value={value}
                onChange={(e) => handleInputChange(step.id, e.target.value)}
                className="w-full pl-4 pr-16 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                min="0"
                step="0.000000000000000001"
                placeholder="Whole tokens (e.g., 10 USDC)"
              />
              {selectedTokenObj && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-blue-600 pointer-events-none">
                  {selectedTokenObj.symbol}
                </span>
              )}
            </div>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      case "category":
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Choose the category that best represents your project's primary
              focus. This helps contributors discover your project and connects
              you with the right community.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-1 gap-y-2 mb-4 justify-center">
              {categoryOptions.map((cat) => {
                const isSelected = formData.category === cat.name;
                return (
                  <Tooltip key={cat.name} title={cat.description} arrow>
                    <span className="w-full flex">
                      <Button
                        onClick={() =>
                          handleInputChange(
                            "category",
                            isSelected ? "" : cat.name
                          )
                        }
                        variant={isSelected ? "contained" : "outlined"}
                        sx={{
                          textTransform: "none",
                          fontWeight: 500,
                          justifyContent: "center",
                          minWidth: 0,
                          width: "100%",
                          m: 0,
                          display: "flex",
                          alignItems: "center",
                        }}
                        disableElevation
                        disableRipple
                      >
                        {cat.name}
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </div>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      case "githubUrl":
        return (
          <div>
            <div className="text-sm text-gray-500 mb-4">
              Sharing your GitHub repository helps establish credibility with
              potential contributors. Public repositories demonstrate
              transparency and allow the community to evaluate your code
              quality.
            </div>
            <input
              type="url"
              value={value}
              onChange={(e) => handleInputChange(step.id, e.target.value)}
              className={`w-full pl-4 pr-4 py-2.5 bg-white border rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all ${
                errorMsg ? "border-red-500" : "border-gray-200"
              }`}
              placeholder="https://github.com/username/repository"
            />
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  // Helper to check if the current step is valid (for disabling Next/Create button)
  const isCurrentStepValid = () => {
    const currentField = steps[currentStep].id;
    const value = formData[currentField as keyof typeof formData];
    // Special handling for duration (date picker)
    if (currentField === "duration") {
      if (!formData.endDate) return false;
      const today = new Date();
      const selectedDate = new Date(formData.endDate);
      const maxDate = addDays(today, 365);
      if (selectedDate <= today || selectedDate > maxDate) return false;
      return true;
    }
    // For githubUrl, check pattern
    if (currentField === "githubUrl") {
      const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/;
      return (
        typeof value === "string" &&
        value.trim() !== "" &&
        value.includes("github.com") &&
        githubUrlPattern.test(value)
      );
    }
    // For description, check length
    if (currentField === "description") {
      return (
        typeof value === "string" && value.trim() !== "" && value.length <= 1250
      );
    }
    // For targetAmount, must be positive number
    if (currentField === "targetAmount") {
      const num = Number(value);
      return (
        typeof value === "string" &&
        value.trim() !== "" &&
        !isNaN(num) &&
        num > 0
      );
    }
    // For token/category, must be selected
    if (currentField === "token" || currentField === "category") {
      return !!value;
    }
    // For all others, just check non-empty and not all spaces
    return typeof value === "string" ? value.trim() !== "" : !!value;
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
      initialFocus={cancelButtonRef}
    >
      <div
        className="fixed inset-0 bg-white/20 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)]"
        aria-hidden="true"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-[0_0_10px_rgba(191,219,254,0.2)] flex flex-col max-h-[90vh] border border-gray-200">
          <div className="h-1 w-full bg-white/20 rounded-t-xl">
            <div
              className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 transition-all rounded-t-xl"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="flex items-center text-lg font-semibold bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                  <PencilSquareIcon className="w-6 h-6 mr-2 text-blue-400" />
                  <span className="bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                    {steps[currentStep].label}
                  </span>
                </h3>
                <span className="text-sm text-blue-400">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 mb-2">
                  {error}
                </div>
              )}
              {renderStep()}
            </div>
          </form>

          <div className="flex justify-between space-x-3 p-6 border-t bg-white/10 rounded-b-xl backdrop-blur-md">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-md hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 border border-gray-200 rounded-md transition-colors duration-200"
                ref={cancelButtonRef}
              >
                Cancel
              </button>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 border border-gray-300 rounded-md transition-colors duration-200"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={
                currentStep === steps.length - 1 ? handleSubmit : handleNext
              }
              disabled={isSubmitting || !isCurrentStepValid()}
              className="relative overflow-hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 group"
            >
              {!isSubmitting && isCurrentStepValid() && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/60 to-primary-400/0 animate-shimmer pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/40 to-primary-400/0 animate-shimmer [animation-delay:1s] pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/30 to-primary-400/0 animate-shimmer [animation-delay:2s] pointer-events-none" />
                </>
              )}
              {currentStep === steps.length - 1 ? (
                isSubmitting ? (
                  "Creating..."
                ) : (
                  "Create Campaign"
                )
              ) : (
                <>
                  Next
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
