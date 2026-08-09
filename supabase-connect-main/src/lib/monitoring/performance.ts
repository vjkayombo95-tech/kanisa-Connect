import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { QueryClient } from "@tanstack/react-query";
import { logger } from "./logger";
import { recordDurationMetric } from "./metrics";

const SLOW_QUERY_THRESHOLD_MS = 500;
const LARGE_RENDER_THRESHOLD_MS = 100;

export function getNow() {
  if (typeof performance === "undefined") return Date.now();
  return performance.now();
}

export function markPerformance(name: string) {
  if (typeof performance === "undefined" || !performance.mark) return;
  performance.mark(name);
}

export function measurePerformance(name: string, startMark: string, endMark?: string) {
  if (typeof performance === "undefined" || !performance.measure) return null;

  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }

    const measure = performance.getEntriesByName(name).at(-1);
    return measure?.duration ?? null;
  } catch {
    return null;
  }
}

export function trackPageLoad() {
  if (typeof window === "undefined" || typeof performance === "undefined") return null;

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const loadTime = navigation?.loadEventEnd && navigation.startTime >= 0
    ? navigation.loadEventEnd - navigation.startTime
    : performance.now();

  recordDurationMetric("page_load_time", loadTime);
  return loadTime;
}

export function trackBundleLoadTiming() {
  if (typeof performance === "undefined") return [];

  return performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/assets/") && entry.name.endsWith(".js"))
    .map((entry) => ({
      name: entry.name.split("/").pop() ?? entry.name,
      durationMs: Math.round(entry.duration),
      transferSize: "transferSize" in entry ? (entry as PerformanceResourceTiming).transferSize : undefined,
    }));
}

export function trackAsyncDuration<T>(
  name: string,
  action: () => Promise<T>,
  options?: { slowThresholdMs?: number; tags?: Record<string, string | number | boolean | null | undefined> },
) {
  const startedAt = getNow();

  return action().finally(() => {
    const durationMs = getNow() - startedAt;
    recordDurationMetric(name, durationMs, options?.tags);

    if (durationMs > (options?.slowThresholdMs ?? SLOW_QUERY_THRESHOLD_MS)) {
      logger.warn("Slow operation detected", {
        action: name,
        metadata: {
          durationMs: Math.round(durationMs),
          thresholdMs: options?.slowThresholdMs ?? SLOW_QUERY_THRESHOLD_MS,
          tags: options?.tags,
        },
      });
    }
  });
}

export function trackRenderDuration(name: string, startedAt: number, context?: Record<string, unknown>) {
  const durationMs = getNow() - startedAt;

  if (durationMs > LARGE_RENDER_THRESHOLD_MS) {
    logger.warn("Large render detected", {
      action: name,
      metadata: {
        durationMs: Math.round(durationMs),
        thresholdMs: LARGE_RENDER_THRESHOLD_MS,
        ...context,
      },
    });
  }

  return durationMs;
}

export function createQueryDurationTracker(queryClient: QueryClient) {
  const queryStartTimes = new WeakMap<object, number>();

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;

    const query = event.query;
    const fetchStatus = query.state.fetchStatus;
    const queryKey = JSON.stringify(query.queryKey);

    if (fetchStatus === "fetching") {
      queryStartTimes.set(query, getNow());
      return;
    }

    const startedAt = queryStartTimes.get(query);
    if (typeof startedAt !== "number") return;

    const durationMs = getNow() - startedAt;
    queryStartTimes.delete(query);
    recordDurationMetric("react_query_request_duration", durationMs, {
      queryKey,
      status: query.state.status,
    });

    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn("Slow React Query request", {
        metadata: {
          queryKey,
          durationMs: Math.round(durationMs),
          status: query.state.status,
        },
      });
    }
  });

  return unsubscribe;
}

export function RoutePerformanceMonitor() {
  const location = useLocation();
  const previousRoute = useRef<string | null>(null);
  const startedAt = useRef(getNow());

  useEffect(() => {
    const nextRoute = `${location.pathname}${location.search}`;
    const previous = previousRoute.current;

    if (previous) {
      recordDurationMetric("route_navigation_time", getNow() - startedAt.current, {
        from: previous,
        to: nextRoute,
      });
    }

    previousRoute.current = nextRoute;
    startedAt.current = getNow();
  }, [location.pathname, location.search]);

  return null;
}
