import { supabase } from "@/integrations/supabase/client";
import { assertClientRateLimit } from "@/lib/client-rate-limit";

export type AnalyticsSnapshotRow<TPayload = Record<string, unknown>> = {
  id: string;
  snapshot_type: string;
  period_start: string | null;
  period_end: string | null;
  payload: TPayload;
  generated_at: string;
};

export async function generateAnalyticsSnapshot<TPayload = Record<string, unknown>>(churchId: string) {
  assertClientRateLimit(`analytics-snapshot:${churchId}`, 3, 60 * 60 * 1000, "analytics generations");

  const { data, error } = await supabase.rpc("generate_church_analytics_snapshot" as never, {
    p_church_id: churchId,
  } as never);

  if (error) throw error;
  return data as unknown as AnalyticsSnapshotRow<TPayload>;
}

export async function getLatestAnalyticsSnapshot<TPayload = Record<string, unknown>>(churchId: string) {
  const { data, error } = await supabase
    .from("analytics_snapshots" as never)
    .select("id, snapshot_type, period_start, period_end, payload, generated_at")
    .eq("church_id", churchId)
    .eq("snapshot_type", "monthly_overview")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message?.includes("analytics_snapshots")) return null;
    throw error;
  }

  return data as unknown as AnalyticsSnapshotRow<TPayload> | null;
}

export async function getSnapshotForDateRange<TPayload = Record<string, unknown>>(
  churchId: string,
  startDate: string,
  endDate: string,
) {
  const { data, error } = await supabase
    .from("analytics_snapshots" as never)
    .select("id, snapshot_type, period_start, period_end, payload, generated_at")
    .eq("church_id", churchId)
    .lte("period_start", startDate)
    .gte("period_end", endDate)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message?.includes("analytics_snapshots")) return null;
    throw error;
  }

  return data as unknown as AnalyticsSnapshotRow<TPayload> | null;
}
