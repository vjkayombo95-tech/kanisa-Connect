import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchYouTubeStatus, providerTransition } from "../_shared/livestream-provider.ts";
import { isServiceFeatureAvailable } from "../_shared/feature-eligibility.ts";
import { hasVerifiedServiceRole } from "../_shared/verified-service-role.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type EligibleStream = {
  id: string; church_id: string; status: "scheduled" | "live"; provider: "youtube";
  provider_external_id: string; scheduled_start: string | null;
};

Deno.serve(async (request) => {
  const started = Date.now();
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  // Safe only because supabase/config.toml keeps verify_jwt=true for this
  // function, so the Edge gateway cryptographically verifies this JWT first.
  if (!hasVerifiedServiceRole(request.headers.get("authorization"))) return json(403, { error: "Forbidden" });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json(503, { error: "Livestream synchronization backend is not configured" });
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return json(503, { error: "YouTube status sync is not configured" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const lower = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const upper = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("church_livestreams").select("id,church_id,status,provider,provider_external_id,scheduled_start")
    .eq("provider", "youtube").in("status", ["scheduled", "live"]).not("provider_external_id", "is", null)
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_start.gte.${lower},scheduled_start.lte.${upper})`)
    .or(`provider_next_sync_at.is.null,provider_next_sync_at.lte.${now.toISOString()}`).limit(25);
  if (error) { console.error("livestream-sync eligibility", { category: "database", message: error.message }); return json(500, { error: "Eligibility query failed" }); }

  const results: Array<{ id: string; providerStatus: string; transition: string | null; outcome: string }> = [];
  for (const stream of (data ?? []) as EligibleStream[]) {
    if (!await isServiceFeatureAvailable(db, stream.church_id, "livestream")) {
      results.push({ id: stream.id, providerStatus: "unknown", transition: null, outcome: "feature_disabled" });
      continue;
    }
    const provider = await fetchYouTubeStatus(stream.provider_external_id, apiKey);
    const transition = providerTransition(stream.status, provider.status);
    const { error: applyError } = await db.rpc("apply_livestream_provider_check", {
      _livestream_id: stream.id, _church_id: stream.church_id, _provider: provider.provider,
      _provider_external_id: provider.providerExternalId, _provider_status: provider.status,
      _checked_at: provider.checkedAt, _actual_started_at: provider.actualStartedAt,
      _actual_ended_at: provider.actualEndedAt, _thumbnail_url: provider.thumbnailUrl,
      _recording_url: provider.recordingUrl, _error_category: provider.errorCategory,
    });
    const outcome = applyError ? "apply_failed" : transition ? "transitioned" : provider.errorCategory ? "provider_failure" : "no_change";
    if (applyError) console.error("livestream-sync apply", { streamId: stream.id, churchId: stream.church_id, provider: stream.provider, category: "database", message: applyError.message });
    else console.info("livestream-sync check", { streamId: stream.id, churchId: stream.church_id, provider: stream.provider, providerExternalId: stream.provider_external_id, previousStatus: stream.status, providerStatus: provider.status, transition, errorCategory: provider.errorCategory });
    results.push({ id: stream.id, providerStatus: provider.status, transition, outcome });
  }

  await db.from("system_jobs").update({ last_run_at: new Date().toISOString(), last_status: results.some((r) => r.outcome === "apply_failed") ? "partial_failure" : "success", last_duration_ms: Date.now() - started, updated_at: new Date().toISOString() }).eq("job_name", "Livestream Provider Sync");
  return json(200, { checked: results.length, results });
});
