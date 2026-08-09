import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const AUDIO_BUCKETS = new Set([
  "audio",
  "audio-reports",
  "audio-indexes",
  "audio-transcripts",
  "audio-alignments",
]);

const CONTENT_TYPES = new Set(["bible", "readings", "saints", "catechism", "homilies"]);
type AudioCmsAction =
  | "create_job"
  | "create_upload_url"
  | "register_asset"
  | "read_report"
  | "read_manifest";

type JsonRecord = Record<string, unknown>;

function jsonResponse(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireUuid(value: unknown, field: string): string {
  const uuid = requireString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error(`${field} must be a UUID.`);
  }
  return uuid;
}

function requireInteger(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return numberValue;
}

function requireAllowed(value: unknown, allowed: Set<string>, field: string): string {
  const normalized = requireString(value, field).toLowerCase();
  if (!allowed.has(normalized)) {
    throw new Error(`${field} is not supported.`);
  }
  return normalized;
}

function safeFileName(value: unknown): string {
  return requireString(value, "fileName").replace(/[^a-zA-Z0-9._-]/g, "_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return jsonResponse(500, { error: "Supabase environment is not configured." });
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse(401, { error: "Authentication required." });
    }

    const payload = (await req.json()) as JsonRecord;
    const action = requireAllowed(payload.action, new Set<AudioCmsAction>([
      "create_job",
      "create_upload_url",
      "register_asset",
      "read_report",
      "read_manifest",
    ]), "action") as AudioCmsAction;

    if (action !== "read_report" && action !== "read_manifest") {
      const churchId = requireUuid(payload.churchId, "churchId");
      const requiredAction = action === "create_job" ? "create" : "edit";
      const { data: allowed, error: permissionError } = await supabase.rpc("has_church_feature_permission", {
        _user_id: user.id,
        _church_id: churchId,
        _feature_key: "audio_processing",
        _action: requiredAction,
      });
      if (permissionError) throw permissionError;
      if (!allowed) return jsonResponse(403, { error: "Audio processing permission required." });
    }

    if (action === "create_job") {
      const churchId = requireUuid(payload.churchId, "churchId");
      const contentType = requireAllowed(payload.contentType, CONTENT_TYPES, "contentType");
      const book = requireString(payload.book, "book");
      const chapter = requireInteger(payload.chapter, "chapter");

      const { data, error } = await supabase.rpc("create_audio_job_draft", {
        _church_id: churchId,
        _content_type: contentType,
        _book: book,
        _chapter: chapter,
      });

      if (error) throw error;
      return jsonResponse(200, { job: data });
    }

    if (action === "create_upload_url") {
      const churchId = requireUuid(payload.churchId, "churchId");
      const jobId = requireUuid(payload.jobId, "jobId");
      const bucket = requireAllowed(payload.bucket, AUDIO_BUCKETS, "bucket");
      const path = `${churchId}/${jobId}/${Date.now()}-${safeFileName(payload.fileName)}`;

      const { data: job, error: jobError } = await supabase
        .from("audio_jobs")
        .select("id, church_id, status")
        .eq("id", jobId)
        .eq("church_id", churchId)
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) {
        return jsonResponse(404, { error: "Audio job not found." });
      }
      if (!["DRAFT", "UPLOADING", "draft", "uploading"].includes(String(job.status))) {
        return jsonResponse(409, { error: "Audio job is not accepting uploads." });
      }

      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

      if (error) throw error;
      return jsonResponse(200, { bucket, path, token: data.token, signedUrl: data.signedUrl });
    }

    if (action === "register_asset") {
      const churchId = requireUuid(payload.churchId, "churchId");
      const jobId = requireUuid(payload.jobId, "jobId");
      const bucket = requireAllowed(payload.bucket, AUDIO_BUCKETS, "bucket");
      const assetType = requireString(payload.assetType, "assetType");
      const storagePath = requireString(payload.storagePath, "storagePath");

      if (splitPathChurch(storagePath) !== churchId || splitPathJob(storagePath) !== jobId) {
        return jsonResponse(400, { error: "Storage path does not match audio job." });
      }

      const { data, error } = await supabase.rpc("register_audio_asset", {
        _job_id: jobId,
        _asset_type: assetType,
        _storage_bucket: bucket,
        _storage_path: storagePath,
        _content_type: optionalString(payload.contentType),
        _file_name: optionalString(payload.fileName),
        _file_size: typeof payload.fileSize === "number" ? payload.fileSize : null,
      });

      if (error) throw error;
      return jsonResponse(200, { asset: data });
    }

    const path = requireString(payload.path, "path");
    const churchId = requireUuid(splitPathChurch(path), "path churchId");
    const { data: canRead, error: readPermissionError } = await supabase.rpc("has_church_feature_permission", {
      _user_id: user.id,
      _church_id: churchId,
      _feature_key: "audio_processing",
      _action: "view",
    });
    if (readPermissionError) throw readPermissionError;
    if (!canRead) return jsonResponse(403, { error: "Audio processing permission required." });
    const bucket = action === "read_manifest" ? "audio-reports" : requireAllowed(payload.bucket ?? "audio-reports", AUDIO_BUCKETS, "bucket");
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw error;

    return jsonResponse(200, { content: await data.text() });
  } catch (error) {
    console.error("audio-cms request failed", error);
    return jsonResponse(400, { error: "Audio CMS request failed." });
  }
});

function splitPathChurch(path: string) {
  return path.split("/")[0] ?? "";
}

function splitPathJob(path: string) {
  return path.split("/")[1] ?? "";
}
