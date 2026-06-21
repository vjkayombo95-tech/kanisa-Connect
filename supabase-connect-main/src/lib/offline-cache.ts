export function readOfflineCache<T>(key: string | null, fallback: T): T {
  if (!key || typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeOfflineCache<T>(key: string | null, value: T) {
  if (!key || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache write failures.
  }
}

/** Remove application data that must not survive a user change on a shared device. */
export function clearSensitiveOfflineData() {
  if (typeof window === "undefined") return;

  const sensitivePrefixes = ["offline-cache:", "offline-draft:"];
  const sensitiveKeys = new Set(["offline-sync-queue"]);

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && (sensitiveKeys.has(key) || sensitivePrefixes.some((prefix) => key.startsWith(prefix)))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // A storage failure must not prevent logout.
  }
}

export async function withOfflineCache<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  fallback: T,
) {
  try {
    const data = await fetcher();
    writeOfflineCache(key, data);
    return data;
  } catch (error) {
    const cached = readOfflineCache(key, fallback);
    const hasCachedData = JSON.stringify(cached) !== JSON.stringify(fallback);

    if (hasCachedData) {
      return cached;
    }

    throw error;
  }
}
