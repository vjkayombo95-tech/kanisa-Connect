import { useEffect, useState } from "react";

import { getOfflineSyncEventName, getOfflineSyncQueue } from "@/lib/offline-sync";

export function useOfflineSyncQueue() {
  const [queue, setQueue] = useState(() => getOfflineSyncQueue());

  useEffect(() => {
    const refreshQueue = () => setQueue(getOfflineSyncQueue());
    const eventName = getOfflineSyncEventName();

    window.addEventListener(eventName, refreshQueue);
    window.addEventListener("storage", refreshQueue);

    return () => {
      window.removeEventListener(eventName, refreshQueue);
      window.removeEventListener("storage", refreshQueue);
    };
  }, []);

  return queue;
}
