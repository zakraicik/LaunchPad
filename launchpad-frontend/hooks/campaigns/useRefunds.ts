import { useQuery } from "@tanstack/react-query";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import { useHydration } from "../../pages/_app";

export const useRefunds = (address?: string) => {
  const { isHydrated } = useHydration();

  return useQuery({
    queryKey: ["refunds", address],
    queryFn: async () => {
      if (!address) return { refundEvents: [], campaignRefunds: {} };

      try {
        // Fetch refund events
        const refundEventsRef = collection(db, "refundEvents");
        const q = query(
          refundEventsRef,
          where("contributor", "==", address.toLowerCase()),
          orderBy("blockTimestamp", "desc")
        );
        const querySnapshot = await getDocs(q);

        const events = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            campaignId: data.campaignId,
            contributor: data.contributor,
            amount: data.amount,
            blockNumber: data.blockNumber,
            blockTimestamp: data.blockTimestamp.toDate(),
            transactionHash: data.transactionHash,
            tokenAddress: data.token,
          };
        });

        // Fetch campaign refund details for each event
        const campaignPromises = events.map(async (event) => {
          const campaignRef = doc(db, "campaigns", event.campaignId);
          const campaignSnap = await getDoc(campaignRef);
          if (campaignSnap.exists()) {
            const data = campaignSnap.data();
            return {
              id: campaignSnap.id,
              totalRefunds: data.totalRefunds || "0",
              token: data.token,
              campaignAddress: data.campaignAddress,
              title: data.title || "Unnamed Campaign",
            };
          }
          return null;
        });

        const campaignResults = await Promise.all(campaignPromises);
        const campaignRefundsMap = campaignResults.reduce((acc, campaign) => {
          if (campaign) {
            acc[campaign.id] = campaign;
          }
          return acc;
        }, {} as Record<string, any>);

        return {
          refundEvents: events,
          campaignRefunds: campaignRefundsMap,
        };
      } catch (error) {
        console.error("Error fetching refunds:", error);
        throw error;
      }
    },
    // Only enable query when both address is available AND component is hydrated
    enabled: !!address && isHydrated,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
};
