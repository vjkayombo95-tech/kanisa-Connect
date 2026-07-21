import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APPROVED_STAGING_REF = "nunfrjcuimaytydnaqtt";
const CONFIRMATION = "IMPORT_PRAYERS_TO_STAGING_AS_DRAFT";
const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type JsonRecord = Record<string, unknown>;

function response(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return response(500, { error: "Prayer importer is not configured." });

    const hostname = new URL(supabaseUrl).hostname.toLowerCase();
    if (hostname !== `${APPROVED_STAGING_REF}.supabase.co`) {
      return response(403, { error: "Prayer imports are restricted to the approved staging project." });
    }

    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return response(401, { error: "Authentication required." });

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return response(401, { error: "Authentication required." });

    const payload = await request.json() as JsonRecord;
    const forbiddenIdentityKeys = ["initiatedBy", "initiatedByUserUuid", "initiated_by_user_uuid", "email", "displayName"];
    if (forbiddenIdentityKeys.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
      return response(400, { error: "Initiating identity is derived from the authenticated session and cannot be supplied by the client." });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [platformAdmin, legacyAdmin, profile] = await Promise.all([
      serviceClient.rpc("is_platform_super_admin", { _user_id: authData.user.id }),
      serviceClient.rpc("is_super_admin", { _user_id: authData.user.id }),
      serviceClient.from("profiles").select("full_name").eq("id", authData.user.id).maybeSingle(),
    ]);
    if (platformAdmin.error) throw platformAdmin.error;
    if (legacyAdmin.error) throw legacyAdmin.error;
    if (profile.error) throw profile.error;
    if (platformAdmin.data !== true && legacyAdmin.data !== true) return response(403, { error: "Super Admin access required." });

    // Capture the verified actor for diagnostics. The RPC independently derives
    // and stores these snapshots from trusted tables using the verified UUID.
    const initiatedBy = {
      userUuid: authData.user.id,
      email: authData.user.email ?? null,
      displayName: profile.data?.full_name
        ?? authData.user.user_metadata?.full_name
        ?? authData.user.user_metadata?.name
        ?? authData.user.email
        ?? null,
    };

    if (payload.mode === "preflight") {
      return response(200, {
        status: "Preflight passed",
        environment: "staging",
        projectRef: APPROVED_STAGING_REF,
        initiatedBy,
        executedBy: "service_role",
        importsExecuted: 0,
      });
    }

    const filename = requireString(payload.filename, "filename");
    const workbookChecksum = requireString(payload.workbookChecksum, "workbookChecksum").toUpperCase();
    const confirmation = requireString(payload.confirmation, "confirmation");
    if (!/^[A-F0-9]{64}$/.test(workbookChecksum)) return response(400, { error: "workbookChecksum must be a SHA-256 value." });
    if (confirmation !== CONFIRMATION) return response(400, { error: "Exact staging import confirmation is required." });
    if (!Array.isArray(payload.changes) || payload.changes.length === 0 || payload.changes.length > 1000) {
      return response(400, { error: "A non-empty validated update plan of at most 1000 changes is required." });
    }

    const { data, error } = await serviceClient.rpc("apply_staging_prayer_import", {
      _filename: filename,
      _workbook_checksum: workbookChecksum,
      _changes: payload.changes,
      _confirmation: confirmation,
      _initiated_by_user_uuid: authData.user.id,
    });
    if (error) throw error;

    return response(200, { ...(data as JsonRecord), initiatedBy, executedBy: "service_role" });
  } catch (error) {
    console.error("Prayer import failed", error);
    return response(400, { error: error instanceof Error ? error.message : "Prayer import failed." });
  }
});
