import { useAccount } from "wagmi";
import { useIsAdmin } from "../../utils/admin";
import { useHydration } from "@/pages/_app";
import { useRouter } from "next/router";
import { ChartBarIcon } from "@heroicons/react/24/outline";

export default function PlatformMetrics() {
  const router = useRouter();
  const { isHydrated } = useHydration();
  const { address } = useAccount();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address);

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

  return (
    <div className="container mx-auto px-4 py-8 mt-20 min-h-[calc(100vh-80px)]">
      <div className="flex items-center gap-4 mb-8">
        <ChartBarIcon className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Metrics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor platform performance and analytics
          </p>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
        <p className="text-gray-500">
          Platform metrics dashboard coming soon...
        </p>
      </div>
    </div>
  );
}
