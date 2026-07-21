import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(500, { error: "Operations metrics environment is not configured." });
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
    const { data, error } = await serviceClient.rpc("get_audio_operations_metrics", { _church_id: churchId });
    if (error) throw error;

    return jsonResponse(200, { metrics: data ?? {} });
  } catch (error) {
    console.error("operations-metrics request failed", error);
    return jsonResponse(400, { error: "Operations metrics request failed." });
  }
});
