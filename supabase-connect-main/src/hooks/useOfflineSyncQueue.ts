import { getOfflineSyncEventName, getOfflineSyncQueue } from "@/lib/offline-sync";

export function useOfflineSyncQueue() {
  void getOfflineSyncEventName;
  return getOfflineSyncQueue();
}
