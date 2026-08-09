import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceFeatureAvailable } from "../_shared/feature-eligibility.ts";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-worker-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type JsonRecord = Record<string, unknown>;

function jsonResponse(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function requireUuid(value: unknown, field: string) {
  const uuid = requireString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(uuid)) {
    throw new Error(`${field} must be a UUID.`);
  }
  return uuid;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventForStatus(status: string) {
  if (["FAILED", "failed"].includes(status)) return "worker_failure";
  if (["COMPLETED", "completed", "REVIEW_REQUIRED", "needs_review"].includes(status)) return "worker_finished";
  if (["QUEUED", "queued"].includes(status)) return "worker_queued";
  return "worker_started";
}

function requireProgress(value: unknown) {
  const progress = Number(value);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new Error("progress must be 0-100.");
  return progress;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const workerSecret = Deno.env.get("AUDIO_WORKER_SECRET");
    if (!supabaseUrl || !serviceRoleKey || !workerSecret) {
      return jsonResponse(500, { error: "Worker environment is not configured." });
    }

    if (req.headers.get("x-worker-secret") !== workerSecret) {
      return jsonResponse(403, { error: "Worker credentials required." });
    }

    const payload = (await req.json()) as JsonRecord;
    const action = requireString(payload.action, "action");
    if (action !== "update_job") {
      return jsonResponse(400, { error: "Unsupported worker action." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const jobId = requireUuid(payload.jobId, "jobId");
    const { data: jobScope, error: jobScopeError } = await supabase
      .from("audio_jobs").select("church_id").eq("id", jobId).maybeSingle();
    if (jobScopeError || !jobScope?.church_id) return jsonResponse(404, { error: "Audio job not found." });
    if (!await isServiceFeatureAvailable(supabase, jobScope.church_id, "audio_processing")) {
      return jsonResponse(403, { error: "Audio processing is unavailable for this church." });
    }
    const status = requireString(payload.status, "status");
    const processingStage = requireString(payload.processingStage, "processingStage");
    const progress = requireProgress(payload.progress);
    const workerId = optionalString(payload.workerId) ?? "audio-worker";
    const workerType = optionalString(payload.workerType) ?? "edge";

    const { data, error } = await supabase.rpc("worker_update_audio_job", {
      _job_id: jobId,
      _status: status,
      _processing_stage: processingStage,
      _progress: progress,
      _audio_url: optionalString(payload.audioUrl),
      _text_url: optionalString(payload.textUrl),
      _index_url: optionalString(payload.indexUrl),
      _report_url: optionalString(payload.reportUrl),
      _manifest_url: optionalString(payload.manifestUrl),
      _error_message: optionalString(payload.errorMessage),
    });

    if (error) throw error;

    try {
      const job = (data ?? {}) as JsonRecord;
      await supabase.rpc("record_audio_worker_heartbeat", {
        _worker_id: workerId,
        _worker_type: workerType,
        _status: status,
        _current_job_id: jobId,
        _metadata: {
          processingStage,
          progress,
        },
      });

      await supabase.rpc("log_operational_event", {
        _church_id: typeof job.church_id === "string" ? job.church_id : null,
        _job_id: jobId,
        _event_type: eventForStatus(status),
        _severity: ["FAILED", "failed"].includes(status) ? "error" : "info",
        _source: "audio-worker",
        _message: `Audio worker reported ${status}.`,
        _metadata: {
          processingStage,
          progress,
          workerId,
          workerType,
        },
      });
    } catch (eventError) {
      console.warn("audio worker operational log skipped", eventError);
    }

    return jsonResponse(200, { job: data });
  } catch (error) {
    console.error("audio-worker request failed", error);
    return jsonResponse(400, { error: "Audio worker request failed." });
  }
});
