import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type JsonRecord = Record<string, unknown>;
type CheckStatus = "ok" | "warning" | "error";

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

function check(status: CheckStatus, message: string, metadata: JsonRecord = {}) {
  return { status, message, checkedAt: new Date().toISOString(), ...metadata };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(500, { error: "Operations health environment is not configured." });
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse(401, { error: "Authentication required." });

    const payload = (await req.json()) as JsonRecord;
    const churchId = requireUuid(payload.churchId, "churchId");
    const { data: canManage, error: accessError } = await userClient.rpc("has_church_feature_permission", {
      _user_id: user.id,
      _church_id: churchId,
      _feature_key: "operations",
      _action: "view",
    });
    if (accessError) throw accessError;
    if (!canManage) return jsonResponse(403, { error: "Operations access required." });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const dbCheck = await serviceClient.from("churches").select("id", { count: "exact", head: true }).limit(1);
    const storageCheck = await serviceClient.storage.from("audio").list(churchId, { limit: 1 });
    const healthResult = await serviceClient.rpc("get_audio_operations_health", { _church_id: churchId });

    if (healthResult.error) throw healthResult.error;
    const health = (healthResult.data ?? {}) as JsonRecord;
    const metrics = (health.metrics ?? {}) as JsonRecord;

    const edgeRuntime = check("ok", "Operations Edge Function runtime is responding.", {
      functions: ["operations-health", "operations-metrics", "audio-worker", "member-audio", "audio-cms"],
    });

    return jsonResponse(200, {
      health: {
        ...health,
        database: dbCheck.error
          ? check("error", "Database connectivity failed.")
          : check("ok", "Database connectivity verified."),
        storage: storageCheck.error
          ? check("warning", "Audio storage bucket check could not list objects.")
          : check("ok", "Audio storage bucket is reachable."),
        edgeFunctions: edgeRuntime,
        queue: check(Number(metrics.failedJobs ?? 0) > 0 ? "warning" : "ok", "Audio queue metrics are available.", {
          depth: metrics.queueDepth ?? 0,
          failedJobs: metrics.failedJobs ?? 0,
        }),
      },
    });
  } catch (error) {
    console.error("operations-health request failed", error);
    return jsonResponse(400, { error: "Operations health request failed." });
  }
});
