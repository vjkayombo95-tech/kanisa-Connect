import { useEffect, useState } from "react";
import { CloudOff, Wifi, WifiOff } from "lucide-react";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getOfflineSyncEventName, getOfflineSyncQueueCount } from "@/lib/offline-sync";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getOfflineSyncQueueCount());

  useEffect(() => {
    if (!isOnline) {
      setShowRestored(false);
      return;
    }

    setShowRestored(true);
    const timer = window.setTimeout(() => setShowRestored(false), 4000);
    return () => window.clearTimeout(timer);
  }, [isOnline]);

  useEffect(() => {
    const refreshCount = () => setPendingCount(getOfflineSyncQueueCount());
    window.addEventListener(getOfflineSyncEventName(), refreshCount);
    window.addEventListener("online", refreshCount);

    return () => {
      window.removeEventListener(getOfflineSyncEventName(), refreshCount);
      window.removeEventListener("online", refreshCount);
    };
  }, []);

  if (isOnline && !showRestored && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`sticky top-0 z-[120] border-b px-4 py-2 text-sm shadow-sm ${
        isOnline
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          : "border-amber-500/20 bg-amber-500/10 text-amber-100"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span className="font-medium">
          {isOnline ? "Back online." : "You’re offline."}
        </span>
        <span className="opacity-90">
          {isOnline
            ? "New changes can sync again."
            : "Previously loaded pages can still open, but new Supabase data and uploads will wait for internet."}
        </span>
        {pendingCount > 0 ? (
          <span className="ml-auto text-xs font-medium uppercase tracking-[0.14em] opacity-90">
            {pendingCount} pending sync
          </span>
        ) : null}
        {!isOnline ? <CloudOff className="ml-auto h-4 w-4 opacity-80" /> : null}
      </div>
    </div>
  );
}
