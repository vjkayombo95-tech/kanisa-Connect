import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getAudioDashboardSummary, listAudioJobs, type AudioJobStatus } from "@/lib/audio-cms";

type UseAudioJobsOptions = {
  search?: string;
  status?: AudioJobStatus | "all";
  sortAsc?: boolean;
  page?: number;
  pageSize?: number;
};

function useRealtimeInvalidation(params: {
  churchId: string | null | undefined;
  queryKeyPrefix: string;
  onFallbackChange: (value: boolean) => void;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!params.churchId) return undefined;
    params.onFallbackChange(false);

    const channel = supabase
      .channel(`${params.queryKeyPrefix}-${params.churchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audio_jobs",
          filter: `church_id=eq.${params.churchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [params.queryKeyPrefix, params.churchId] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") params.onFallbackChange(false);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") params.onFallbackChange(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params, queryClient]);
}

export function useAudioJobs(churchId: string | null | undefined, options: UseAudioJobsOptions = {}) {
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const queryKey = useMemo(
    () => ["audio-jobs", churchId, options.search ?? "", options.status ?? "all", !!options.sortAsc, options.page ?? 1, options.pageSize ?? 25] as const,
    [churchId, options.page, options.pageSize, options.search, options.sortAsc, options.status],
  );

  const realtimeParams = useMemo(
    () => ({ churchId, queryKeyPrefix: "audio-jobs", onFallbackChange: setUsePollingFallback }),
    [churchId],
  );
  useRealtimeInvalidation(realtimeParams);

  return useQuery({
    queryKey,
    queryFn: () =>
      churchId
        ? listAudioJobs({
            churchId,
            search: options.search,
            status: options.status,
            sortAsc: options.sortAsc,
            page: options.page,
            pageSize: options.pageSize,
          })
        : Promise.resolve({ jobs: [], totalCount: 0, page: options.page ?? 1, pageSize: options.pageSize ?? 25 }),
    enabled: !!churchId,
    refetchInterval: usePollingFallback ? 15000 : false,
  });
}

export function useAudioDashboard(churchId: string | null | undefined) {
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const queryKey = useMemo(() => ["audio-dashboard", churchId] as const, [churchId]);
  const realtimeParams = useMemo(
    () => ({ churchId, queryKeyPrefix: "audio-dashboard", onFallbackChange: setUsePollingFallback }),
    [churchId],
  );
  useRealtimeInvalidation(realtimeParams);

  return useQuery({
    queryKey,
    queryFn: () => (churchId ? getAudioDashboardSummary(churchId) : Promise.resolve({ processing: 0, completed: 0, needsReview: 0, published: 0, failed: 0, recentJobs: [] })),
    enabled: !!churchId,
    refetchInterval: usePollingFallback ? 15000 : false,
  });
}
