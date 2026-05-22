import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getOfflineSyncEventName, processOfflineSyncQueue } from "@/lib/offline-sync";
import { useToast } from "@/hooks/use-toast";

export function OfflineSyncManager() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [queueTick, setQueueTick] = useState(0);
  const processingRef = useRef(false);

  useEffect(() => {
    const handleQueueChanged = () => setQueueTick((current) => current + 1);
    window.addEventListener(getOfflineSyncEventName(), handleQueueChanged);
    return () => window.removeEventListener(getOfflineSyncEventName(), handleQueueChanged);
  }, []);

  useEffect(() => {
    if (!isOnline || !user || processingRef.current) {
      return;
    }

    processingRef.current = true;

    processOfflineSyncQueue(queryClient)
      .then((result) => {
        if (result.processedCount > 0) {
          toast({
            title: "Offline changes synced",
            description:
              result.remainingCount > 0
                ? `${result.processedCount} queued changes synced. ${result.remainingCount} still waiting.`
                : `${result.processedCount} queued changes synced successfully.`,
          });
        }
      })
      .catch((error: Error) => {
        console.warn("Offline sync failed:", error.message);
      })
      .finally(() => {
        processingRef.current = false;
      });
  }, [isOnline, queryClient, queueTick, toast, user]);

  return null;
}
