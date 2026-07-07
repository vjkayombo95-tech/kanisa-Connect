export const DAILY_CATHOLIC_STALE_TIME = 12 * 60 * 60 * 1000;
export const DAILY_CATHOLIC_GC_TIME = 24 * 60 * 60 * 1000;
export const BIBLE_STALE_TIME = 24 * 60 * 60 * 1000;
export const BIBLE_GC_TIME = 7 * 24 * 60 * 60 * 1000;

export const dailyCatholicQueryOptions = {
  staleTime: DAILY_CATHOLIC_STALE_TIME,
  gcTime: DAILY_CATHOLIC_GC_TIME,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export const bibleQueryOptions = {
  staleTime: BIBLE_STALE_TIME,
  gcTime: BIBLE_GC_TIME,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

export const livePortalQueryOptions = {
  staleTime: 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;
