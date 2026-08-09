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

function requireChapter(value: unknown) {
  const chapter = Number(value);
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("chapter must be a positive integer.");
  return chapter;
}

function normalizeBook(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function logPlaybackFailure(
  serviceClient: ReturnType<typeof createClient>,
  churchId: string,
  reason: string,
  metadata: JsonRecord,
) {
  try {
    await serviceClient.rpc("log_operational_event", {
      _church_id: churchId,
      _job_id: null,
      _event_type: "playback_failure",
      _severity: "warning",
      _source: "member-audio",
      _message: reason,
      _metadata: metadata,
    });
  } catch (error) {
    console.warn("playback failure log skipped", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(500, { error: "Playback environment is not configured." });
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
    const book = requireString(payload.book, "book");
    const abbreviation = typeof payload.abbreviation === "string" ? payload.abbreviation : "";
    const chapter = requireChapter(payload.chapter);

    const { data: canAccess, error: accessError } = await userClient.rpc("has_church_feature_permission", {
      _user_id: user.id,
      _church_id: churchId,
      _feature_key: "audio_processing",
      _action: "view",
    });
    if (accessError) throw accessError;
    if (!canAccess) return jsonResponse(403, { error: "Member access required." });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const accepted = [normalizeBook(book), normalizeBook(abbreviation)].filter(Boolean);
    const lookups = await Promise.all(
      accepted.map((bookNormalized) =>
        serviceClient.rpc("get_published_audio_lookup", {
          _church_id: churchId,
          _content_type: "bible",
          _book_normalized: bookNormalized,
          _chapter: chapter,
        }),
      ),
    );

    const lookupError = lookups.find((result) => result.error)?.error;
    if (lookupError) throw lookupError;

    const version = lookups.flatMap((result) => (result.data ?? []) as Array<Record<string, unknown>>)[0];

    if (!version || typeof version.audio_url !== "string" || !version.audio_url) {
      await logPlaybackFailure(serviceClient, churchId, "No published audio was available for playback.", {
        book,
        abbreviation,
        chapter,
      });
      return jsonResponse(200, { audio: null });
    }

    const { data: verses, error: versesError } = await serviceClient
      .from("audio_version_verses")
      .select("verse_number, verse_text, start_time, end_time, duration, confidence")
      .eq("version_id", version.version_id)
      .order("verse_number", { ascending: true });
    if (versesError) throw versesError;

    const { data: signed, error: signedError } = await serviceClient.storage
      .from("audio")
      .createSignedUrl(version.audio_url, 60 * 30);
    if (signedError) {
      await logPlaybackFailure(serviceClient, churchId, "Signed playback URL creation failed.", {
        book,
        abbreviation,
        chapter,
        versionId: version.version_id,
      });
      throw signedError;
    }

    return jsonResponse(200, {
      audio: {
        jobId: version.job_id,
        versionId: version.version_id,
        versionNumber: version.version_number,
        audioUrl: signed.signedUrl,
        storagePath: version.audio_url,
        downloaded: false,
        expiresIn: 60 * 30,
        verses: (verses ?? []).map((verse: Record<string, unknown>) => ({
          verse: verse.verse_number,
          text: verse.verse_text,
          start: Number(verse.start_time),
          end: Number(verse.end_time),
          duration: Number(verse.duration),
          confidence: Number(verse.confidence),
        })),
      },
    });
  } catch (error) {
    console.error("member-audio request failed", error);
    return jsonResponse(400, { error: "Member audio request failed." });
  }
});
