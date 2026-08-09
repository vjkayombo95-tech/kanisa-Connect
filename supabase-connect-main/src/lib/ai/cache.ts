import type { KanisaAIResponse } from "./types";

export type KanisaAICache = {
  get: (key: string) => KanisaAIResponse | null;
  set: (key: string, value: KanisaAIResponse, ttlMs?: number) => void;
  delete: (key: string) => void;
  clear: () => void;
};

type CacheEntry = {
  value: KanisaAIResponse;
  expiresAt: number | null;
};

export function createMemoryKanisaAICache(): KanisaAICache {
  const entries = new Map<string, CacheEntry>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value, ttlMs) {
      entries.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : null,
      });
    },
    delete(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
}

export const kanisaAICache = createMemoryKanisaAICache();
