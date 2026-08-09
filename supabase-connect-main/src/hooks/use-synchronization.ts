import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { SynchronizationEngine } from "@/lib/synchronization";
import type {
  SynchronizationIndex,
  SynchronizationProvider,
  SynchronizationSegment,
  SynchronizationSegmentType,
} from "@/types/synchronization";

export function useSynchronization(provider: SynchronizationProvider | null | undefined) {
  return useQuery({
    queryKey: ["synchronization", provider],
    queryFn: () => provider ? provider.load() : Promise.resolve(null),
    enabled: !!provider,
  });
}

export function useSynchronizationEngine(index: SynchronizationIndex | null | undefined) {
  return useMemo(() => (index ? new SynchronizationEngine(index) : null), [index]);
}

export function useCurrentSegment(params: {
  index?: SynchronizationIndex | null | undefined;
  provider?: SynchronizationProvider | null | undefined;
  currentTime: number;
  type?: SynchronizationSegmentType;
}) {
  const providerQuery = useSynchronization(params.provider);
  const engine = useSynchronizationEngine(params.index ?? providerQuery.data);
  return useMemo(
    () => engine?.currentSegment(params.currentTime, params.type) ?? null,
    [engine, params.currentTime, params.type],
  );
}

export function useCurrentWord(params: {
  index?: SynchronizationIndex | null | undefined;
  provider?: SynchronizationProvider | null | undefined;
  currentTime: number;
}) {
  const providerQuery = useSynchronization(params.provider);
  const engine = useSynchronizationEngine(params.index ?? providerQuery.data);
  return useMemo(() => engine?.currentWord(params.currentTime) ?? null, [engine, params.currentTime]);
}

export function useSeekToSegment(params: {
  index?: SynchronizationIndex | null | undefined;
  provider?: SynchronizationProvider | null | undefined;
  onSeek: (time: number, segment: SynchronizationSegment) => void;
}) {
  const providerQuery = useSynchronization(params.provider);
  const engine = useSynchronizationEngine(params.index ?? providerQuery.data);
  return useCallback(
    (segmentId: string) => {
      if (!engine) return null;
      const time = engine.seekToSegment(segmentId);
      const segment = engine.index.segments.find((item) => item.id === segmentId);
      if (time === null || !segment) return null;
      params.onSeek(time, segment);
      return time;
    },
    [engine, params],
  );
}

export function useSearchSegments(params: {
  index?: SynchronizationIndex | null | undefined;
  provider?: SynchronizationProvider | null | undefined;
  query: string;
  type?: SynchronizationSegmentType;
}) {
  const providerQuery = useSynchronization(params.provider);
  const engine = useSynchronizationEngine(params.index ?? providerQuery.data);
  return useMemo(() => {
    if (engine) return engine.search(params.query, params.type);
    if (params.provider) {
      try {
        return params.provider.search(params.query, params.type);
      } catch {
        return [];
      }
    }
    return [];
  }, [engine, params.provider, params.query, params.type]);
}

export function useAutoScroll(params: {
  activeId: string | null | undefined;
  enabled?: boolean;
  pauseMs?: number;
  behavior?: ScrollBehavior;
}) {
  const [following, setFollowing] = useState(true);
  const timeoutRef = useRef<number | null>(null);
  const enabled = params.enabled ?? true;
  const pauseMs = params.pauseMs ?? 4000;

  useEffect(() => {
    if (!enabled) return undefined;
    const handleManualScroll = () => {
      setFollowing(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setFollowing(true), pauseMs);
    };

    window.addEventListener("wheel", handleManualScroll, { passive: true });
    window.addEventListener("touchmove", handleManualScroll, { passive: true });
    window.addEventListener("keydown", handleManualScroll);

    return () => {
      window.removeEventListener("wheel", handleManualScroll);
      window.removeEventListener("touchmove", handleManualScroll);
      window.removeEventListener("keydown", handleManualScroll);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, pauseMs]);

  useEffect(() => {
    if (!enabled || !following || !params.activeId) return;
    document.getElementById(params.activeId)?.scrollIntoView({
      block: "center",
      behavior: params.behavior ?? "smooth",
    });
  }, [enabled, following, params.activeId, params.behavior]);

  return { following, setFollowing };
}
