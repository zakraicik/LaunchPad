import { useState } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { usePlatformAdmin } from "@/hooks/platformAdmin/usePlatformAdmin";
import { useAddPlatformAdmin } from "@/hooks/platformAdmin/useAddPlatformAdmin";
import { useRemovePlatformAdmin } from "@/hooks/platformAdmin/useRemovePlatformAdmin";
import { formatDistanceToNow, isValid } from "date-fns";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { useHydration } from "@/pages/_app";
import SpeedDialSimple from "../../components/SpeedDialSimple";

export default function PlatformAdmins() {
  const { isHydrated } = useHydration();
  const { admins, isLoading, error, refetch } = usePlatformAdmin();
  const { addPlatformAdmin, isAdding, error: addError } = useAddPlatformAdmin();
  const {
    removePlatformAdmin,
    isRemoving,
    error: removeError,
  } = useRemovePlatformAdmin();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState("");

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHydrated) return;

    const toastId = toast.loading("Adding platform admin...");
    try {
      await addPlatformAdmin(newAdminAddress);
      toast.success("Platform admin added successfully!", { id: toastId });
      setIsModalOpen(false);
      setNewAdminAddress("");
    } catch (err) {
      console.error("Failed to add admin:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add platform admin";
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleRemoveAdmin = async (adminAddress: string) => {
    if (!isHydrated) return;

    const toastId = toast.loading("Removing platform admin...");
    try {
      await removePlatformAdmin(adminAddress);
      toast.success("Platform admin removed successfully!", { id: toastId });
      refetch();
    } catch (err) {
      console.error("Failed to remove admin:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove platform admin";
      toast.error(errorMessage, { id: toastId });
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

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Platform Administrators</h1>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-600">Loading administrators...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Platform Administrators</h1>
          </div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                Error loading administrators:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 mt-20 min-h-[calc(100vh-80px)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Platform Administrators</h1>
      </div>

      {/* Card Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {admins.map((admin) => (
          <div
            key={admin.address}
            className="bg-white/10 backdrop-blur-md rounded-lg shadow p-4 space-y-4 shadow-[0_0_10px_rgba(191,219,254,0.2)]"
          >
            {/* Header with address and remove button */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="font-mono text-sm">
                  {admin.address.slice(0, 6)}...{admin.address.slice(-4)}
                </div>
                <div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      admin.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {admin.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveAdmin(admin.address)}
                disabled={isRemoving}
                className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                title={admin.isActive ? "Remove Admin" : "Restore Admin"}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Admin details section */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              {/* Last Operation */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Operation</span>
                <span className="text-sm font-medium">
                  {admin.lastOperation}
                </span>
              </div>

              {/* Last Updated */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Updated</span>
                <span
                  className="text-sm font-medium text-gray-600"
                  title={admin.lastUpdated}
                >
                  {formatDate(admin.lastUpdated)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="col-span-full text-center py-12">
            <h3 className="text-xl font-semibold mb-4">
              No administrators found
            </h3>
            <p className="text-gray-600 mb-6">
              Add your first platform administrator to get started!
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
              label: "Add Admin",
              onClick: () => setIsModalOpen(true),
            }}
            variant="purple"
          />
        </div>
      )}

      {/* Add Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-white/20 backdrop-blur-md shadow-[0_0_10px_rgba(191,219,254,0.2)]"
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="mx-auto max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-xl shadow-[0_0_10px_rgba(191,219,254,0.2)] flex flex-col max-h-[90vh] border border-gray-200">
              <div className="h-1 w-full bg-white/20 rounded-t-xl">
                <div
                  className="h-1 bg-gradient-to-r from-blue-400 to-blue-500 transition-all rounded-t-xl"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="flex items-center text-lg font-semibold bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                      <PlusIcon className="w-6 h-6 mr-2 text-blue-400" />
                      <span className="bg-gradient-to-r from-blue-700 to-blue-400 bg-clip-text text-transparent">
                        Add New Admin
                      </span>
                    </h3>
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    Add a new platform administrator. This person will have full
                    access to manage platform settings and campaigns.
                  </div>
                  <form onSubmit={handleAddAdmin} className="space-y-4">
                    <div>
                      <label
                        htmlFor="adminAddress"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Admin Address
                      </label>
                      <input
                        type="text"
                        id="adminAddress"
                        value={newAdminAddress}
                        onChange={(e) => setNewAdminAddress(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-md text-base font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                        placeholder="0x..."
                        required
                      />
                    </div>
                    {addError && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
                        {addError}
                      </div>
                    )}
                  </form>
                </div>
              </div>

              <div className="flex justify-between space-x-3 p-6 border-t bg-white/10 rounded-b-xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-md hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 border border-gray-200 rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddAdmin}
                  disabled={isAdding || !newAdminAddress.trim()}
                  className="relative overflow-hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 border border-transparent rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 group"
                >
                  {!isAdding && newAdminAddress.trim() && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/60 to-primary-400/0 animate-shimmer pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/40 to-primary-400/0 animate-shimmer [animation-delay:1s] pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-400/0 via-primary-400/30 to-primary-400/0 animate-shimmer [animation-delay:2s] pointer-events-none" />
                    </>
                  )}
                  {isAdding ? "Adding..." : "Add Admin"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
