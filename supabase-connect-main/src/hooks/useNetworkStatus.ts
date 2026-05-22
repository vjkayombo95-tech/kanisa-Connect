export function useNetworkStatus() {
  return {
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  };
}
