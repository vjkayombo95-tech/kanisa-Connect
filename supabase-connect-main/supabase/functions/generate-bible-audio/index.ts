import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BIBLE_AUDIO_FEATURE_KEY = "bible_audio";
const BIBLE_AUDIO_BUCKET = "bible-audio";
const BIBLE_AUDIO_VERSION = "rc-3.0.0";
const MAX_REQUEST_BYTES = 4096;
const PROVIDER_TIMEOUT_MS = 45_000;
const STALE_GENERATION_MS = 15 * 60 * 1000;

type AudioRequest = {
  translationId: string;
  bookId: string;
  chapterNumber: number;
  languageCode: string;
  voiceId: string;
  audioVersion: string;
  providerModel: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeRequest(input: unknown): AudioRequest {
  if (!input || typeof input !== "object") throw new Error("Bible audio request must be an object.");
  const record = input as Record<string, unknown>;
  if ("text" in record || "narrationText" in record || "verseText" in record || "voiceId" in record || "audioVersion" in record) {
    throw new Error("Member supplied narration text or provider identity is not accepted.");
  }

  const translationId = requireString(record.translationId, "translationId");
  const bookId = requireString(record.bookId, "bookId");
  const chapterNumber = Number(record.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) throw new Error("Invalid chapter.");

  const languageCode = requireString(record.languageCode, "languageCode");
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(languageCode)) throw new Error("Invalid language.");

  return {
    translationId,
    bookId,
    chapterNumber,
    languageCode,
    voiceId: "",
    audioVersion: "",
    providerModel: "",
  };
}

function applyProviderConfig(request: AudioRequest, voiceId: string, audioVersion: string, providerModel: string): AudioRequest {
  return {
    ...request,
    voiceId,
    audioVersion,
    providerModel,
  };
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function buildCacheKey(request: AudioRequest) {
  return [
    request.translationId,
    request.bookId,
    String(request.chapterNumber),
    request.languageCode.toLowerCase(),
    request.voiceId,
    request.audioVersion,
    request.providerModel,
  ].join(":");
}

function storagePath(request: AudioRequest) {
  return [
    segment(request.translationId),
    segment(request.languageCode.toLowerCase()),
    segment(request.voiceId),
    segment(request.audioVersion),
    segment(request.providerModel),
    `${segment(request.bookId)}-${request.chapterNumber}.mp3`,
  ].join("/");
}

function segment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function signedAudioUrl(supabase: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await supabase.storage.from(BIBLE_AUDIO_BUCKET).createSignedUrl(path, 60 * 30);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed. Use POST." });
  }

  let serviceSupabase: ReturnType<typeof createClient> | null = null;
  let activeReservationId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const elevenLabsVoiceId = Deno.env.get("ELEVENLABS_VOICE_ID");
    const elevenLabsModel = Deno.env.get("ELEVENLABS_MODEL_ID") ?? "eleven_multilingual_v2";
    const bibleAudioVersion = Deno.env.get("BIBLE_AUDIO_VERSION") ?? BIBLE_AUDIO_VERSION;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Bible audio backend is not configured.");
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const callerSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await callerSupabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse(401, { success: false, error: "Authentication is required." });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse(413, { success: false, error: "Bible Audio request is too large." });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return jsonResponse(413, { success: false, error: "Bible Audio request is too large." });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (_error) {
      return jsonResponse(400, { success: false, error: "Invalid JSON request body." });
    }

    let audioRequest = normalizeRequest(parsedBody);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    serviceSupabase = supabase;

    const { data: role } = await supabase
      .from("user_roles")
      .select("church_id")
      .eq("user_id", userData.user.id)
      .not("church_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (!role?.church_id) {
      return jsonResponse(403, { success: false, error: "A church membership is required for Bible Audio." });
    }

    const { data: feature, error: featureError } = await supabase
      .from("platform_features")
      .select("id, globally_enabled, globally_locked")
      .eq("key", BIBLE_AUDIO_FEATURE_KEY)
      .maybeSingle();

    if (featureError) throw new Error(featureError.message);
    if (!feature || feature.globally_enabled !== true || feature.globally_locked === true) {
      return jsonResponse(403, { success: false, error: "Bible Audio is disabled." });
    }

    const { data: churchFeature, error: churchFeatureError } = await supabase
      .from("church_features")
      .select("enabled, locked")
      .eq("church_id", role.church_id)
      .eq("feature_id", feature.id)
      .maybeSingle();

    if (churchFeatureError) throw new Error(churchFeatureError.message);
    if (churchFeature && (churchFeature.enabled !== true || churchFeature.locked === true)) {
      return jsonResponse(403, { success: false, error: "Bible Audio is disabled for this church." });
    }

    const { data: translation, error: translationError } = await supabase
      .from("bible_translations")
      .select("id, code, language_code, audio_generation_allowed")
      .eq("id", audioRequest.translationId)
      .maybeSingle();

    if (translationError) throw new Error(translationError.message);
    if (!translation) return jsonResponse(404, { success: false, error: "Translation not found." });
    if (translation.audio_generation_allowed !== true) {
      return jsonResponse(403, { success: false, error: "This translation is not approved for AI audio generation." });
    }

    const { data: book, error: bookError } = await supabase
      .from("bible_books")
      .select("id, translation_id, name")
      .eq("id", audioRequest.bookId)
      .eq("translation_id", audioRequest.translationId)
      .maybeSingle();

    if (bookError) throw new Error(bookError.message);
    if (!book) return jsonResponse(404, { success: false, error: "Invalid book." });

    const { data: chapter, error: chapterError } = await supabase
      .from("bible_chapters")
      .select("id")
      .eq("book_id", audioRequest.bookId)
      .eq("chapter_number", audioRequest.chapterNumber)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) return jsonResponse(404, { success: false, error: "Invalid chapter." });

    if (!elevenLabsVoiceId) {
      return jsonResponse(500, { success: false, error: "Bible Audio voice is not configured." });
    }

    audioRequest = applyProviderConfig(audioRequest, elevenLabsVoiceId, bibleAudioVersion, elevenLabsModel);

    const cacheKey = buildCacheKey(audioRequest);
    const { data: cachedAudio, error: cachedError } = await supabase
      .from("bible_audio_assets")
      .select("id, status, storage_path, generation_started_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cachedError) throw new Error(cachedError.message);
    if (cachedAudio?.status === "ready" && cachedAudio.storage_path) {
      return jsonResponse(200, {
        success: true,
        cached: true,
        audioUrl: await signedAudioUrl(supabase, cachedAudio.storage_path),
        expiresIn: 60 * 30,
      });
    }
    if (cachedAudio && cachedAudio.status !== "failed") {
      const startedAt = cachedAudio.generation_started_at ? Date.parse(cachedAudio.generation_started_at) : Number.NaN;
      const stale = Number.isFinite(startedAt) && Date.now() - startedAt > STALE_GENERATION_MS;
      if (!stale) {
        return jsonResponse(409, { success: false, error: "Bible Audio generation is already in progress." });
      }
    }

    const path = storagePath(audioRequest);
    const reservationPayload = {
      translation_id: audioRequest.translationId,
      book_id: audioRequest.bookId,
      chapter_number: audioRequest.chapterNumber,
      language_code: audioRequest.languageCode,
      voice_id: audioRequest.voiceId,
      audio_version: audioRequest.audioVersion,
      cache_key: cacheKey,
      storage_bucket: BIBLE_AUDIO_BUCKET,
      storage_path: path,
      status: "generating",
      provider: "elevenlabs",
      provider_model: audioRequest.providerModel,
      requested_by: userData.user.id,
      generation_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    };

    const reservationQuery = cachedAudio
      ? supabase
          .from("bible_audio_assets")
          .update(reservationPayload)
          .eq("id", cachedAudio.id)
          .select("id")
          .single()
      : supabase
          .from("bible_audio_assets")
          .insert(reservationPayload)
          .select("id")
          .single();

    const { data: reservation, error: reservationError } = await reservationQuery;

    if (reservationError) {
      return jsonResponse(409, { success: false, error: "Bible Audio generation is already reserved." });
    }
    activeReservationId = reservation.id;

    const { data: verses, error: versesError } = await supabase
      .from("bible_verses")
      .select("verse_number, verse_text")
      .eq("translation_id", audioRequest.translationId)
      .eq("book_id", audioRequest.bookId)
      .eq("chapter_number", audioRequest.chapterNumber)
      .order("verse_number", { ascending: true });

    if (versesError) throw new Error(versesError.message);
    if (!verses?.length) throw new Error("No canonical Bible text is available for this chapter.");

    if (!elevenLabsApiKey) throw new Error("ElevenLabs is not configured.");

    const narrationText = verses.map((verse) => `${verse.verse_number}. ${verse.verse_text}`).join("\n");
    let providerResponse: Response;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const providerUrl = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${audioRequest.voiceId}`);
      providerUrl.searchParams.set("output_format", "mp3_44100_128");

      providerResponse = await fetch(providerUrl, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          model_id: audioRequest.providerModel,
          text: narrationText,
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!providerResponse.ok) {
      throw new Error(`ElevenLabs request failed with status ${providerResponse.status}.`);
    }

    const audioBytes = new Uint8Array(await providerResponse.arrayBuffer());
    if (audioBytes.byteLength === 0) {
      throw new Error("ElevenLabs returned an empty audio response.");
    }

    const upload = await supabase.storage.from(BIBLE_AUDIO_BUCKET).upload(path, audioBytes, {
      contentType: "audio/mpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (upload.error) throw new Error(upload.error.message);

    const { error: updateError } = await supabase
      .from("bible_audio_assets")
      .update({
        status: "ready",
        byte_size: audioBytes.byteLength,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", reservation.id);

    if (updateError) throw new Error(updateError.message);

    return jsonResponse(200, {
      success: true,
      cached: false,
      audioUrl: await signedAudioUrl(supabase, path),
      expiresIn: 60 * 30,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bible Audio generation failed.";
    if (serviceSupabase && activeReservationId) {
      await serviceSupabase
        .from("bible_audio_assets")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeReservationId);
    }
    console.error("generate-bible-audio failed", { error: message });
    return jsonResponse(400, { success: false, error: message });
  }
});
