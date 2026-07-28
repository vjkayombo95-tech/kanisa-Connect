import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBibleNarrationText } from "../_shared/bible-narration.ts";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BIBLE_AUDIO_FEATURE_KEY = "bible_audio";
const BIBLE_AUDIO_BUCKET = "bible-audio";
const BIBLE_AUDIO_PILOT_BUCKET = "bible-audio-pilot";
const BIBLE_AUDIO_VERSION = "rc-3.4.0";
const MAX_REQUEST_BYTES = 4096;
const PILOT_MAX_TEXT_CHARS = 500;
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

type PilotAudioRequest = {
  pilot: true;
  testId: string;
  text: string;
  dryRun: boolean;
  confirmBillableGeneration: boolean;
  diagnostic: boolean;
};

type VoiceConfig = {
  voiceId: string | null;
  source: "environment" | "missing";
  redacted: string;
};

type PilotStage =
  | "request_received"
  | "auth_started"
  | "auth_completed"
  | "pilot_validation_completed"
  | "secrets_validated"
  | "duplicate_check_started"
  | "duplicate_check_completed"
  | "elevenlabs_request_started"
  | "elevenlabs_response_received"
  | "audio_upload_started"
  | "audio_upload_completed"
  | "metadata_upload_started"
  | "metadata_upload_completed"
  | "response_returned"
  | "request_failed";

type PilotSafeContext = {
  testId?: string;
  dryRun?: boolean;
  characterCount?: number;
  modelId?: string;
  voiceSource?: string;
  voiceIdRedacted?: string;
  startedAt: number;
};

class PilotStageError extends Error {
  status: number;
  stage: string;
  errorCode: string;
  providerStatus?: number;
  retryable: boolean;

  constructor(params: {
    message: string;
    status: number;
    stage: string;
    errorCode: string;
    providerStatus?: number;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = "PilotStageError";
    this.status = params.status;
    this.stage = params.stage;
    this.errorCode = params.errorCode;
    this.providerStatus = params.providerStatus;
    this.retryable = params.retryable ?? false;
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function pilotLog(stage: PilotStage, context: PilotSafeContext, extra: Record<string, unknown> = {}) {
  console.info("elevenlabs_pilot", {
    stage,
    test_id: context.testId,
    dry_run: context.dryRun,
    character_count: context.characterCount,
    model_id: context.modelId,
    voice_source: context.voiceSource,
    voice_id_redacted: context.voiceIdRedacted,
    elapsed_ms: Date.now() - context.startedAt,
    ...extra,
  });
}

function pilotFailureResponse(error: PilotStageError, context: PilotSafeContext) {
  pilotLog("request_failed", context, {
    error_category: error.errorCode,
    failed_stage: error.stage,
    provider_status: error.providerStatus,
    retryable: error.retryable,
  });
  return jsonResponse(error.status, {
    ok: false,
    success: false,
    stage: error.stage,
    error_code: error.errorCode,
    message: error.message,
    provider_status: error.providerStatus,
    retryable: error.retryable,
    test_id: context.testId,
  });
}

function isPilotRequest(input: unknown) {
  return Boolean(input && typeof input === "object" && (input as Record<string, unknown>).pilot === true);
}

function normalizePilotRequest(input: unknown): PilotAudioRequest {
  if (!input || typeof input !== "object") throw new Error("Pilot audio request must be an object.");
  const record = input as Record<string, unknown>;
  if (record.pilot !== true) throw new Error("Pilot audio request requires pilot=true.");
  if ("translationId" in record || "bookId" in record || "chapterNumber" in record || "verse" in record || "verses" in record) {
    throw new Error("Pilot audio accepts one supplied text sample only; book, chapter, and verse inputs are rejected.");
  }

  const testId = requireString(record.testId, "testId");
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(testId)) throw new Error("Invalid pilot testId.");

  const text = requireString(record.text, "text");
  if (text.length > PILOT_MAX_TEXT_CHARS) {
    throw new Error(`Pilot text exceeds ${PILOT_MAX_TEXT_CHARS} characters.`);
  }

  return {
    pilot: true,
    testId,
    text,
    dryRun: record.dryRun === true,
    confirmBillableGeneration: record.confirmBillableGeneration === true,
    diagnostic: record.diagnostic === true,
  };
}

function resolveElevenLabsVoiceConfig(): VoiceConfig {
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID")?.trim() || null;
  if (!voiceId) {
    return { voiceId: null, source: "missing", redacted: "" };
  }

  return { voiceId, source: "environment", redacted: redact(voiceId) };
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

function pilotStoragePath(voiceId: string, testId: string) {
  return ["elevenlabs", segment(voiceId), `${segment(testId)}.mp3`].join("/");
}

function segment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function redact(value: string) {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function requestOrigin(request: Request) {
  const publicUrl = Deno.env.get("SUPABASE_PUBLIC_URL") ?? Deno.env.get("PUBLIC_SUPABASE_URL");
  if (publicUrl) return new URL(publicUrl).origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    const forwardedPort = request.headers.get("x-forwarded-port");
    const host =
      forwardedPort && !forwardedHost.includes(":") ? `${forwardedHost}:${forwardedPort}` : forwardedHost;

    if (!host.includes(":") && (host === "127.0.0.1" || host === "localhost")) {
      return `${forwardedProto}://${host}:54321`;
    }

    return `${forwardedProto}://${host}`;
  }

  const origin = new URL(request.url);
  if (origin.hostname.startsWith("supabase_edge_runtime")) {
    return "http://127.0.0.1:54321";
  }

  return origin.origin;
}

function browserReachableSignedUrl(signedUrl: string, request: Request) {
  try {
    const signed = new URL(signedUrl);
    if (signed.hostname !== "kong") return signedUrl;

    return new URL(`${signed.pathname}${signed.search}${signed.hash}`, requestOrigin(request)).toString();
  } catch (_error) {
    return signedUrl;
  }
}

async function signedAudioUrl(supabase: ReturnType<typeof createClient>, path: string, request: Request) {
  const { data, error } = await supabase.storage.from(BIBLE_AUDIO_BUCKET).createSignedUrl(path, 60 * 30);
  if (error) throw new Error(error.message);
  return browserReachableSignedUrl(data.signedUrl, request);
}

function isLocalPilotInvocation(request: Request) {
  const token = Deno.env.get("ELEVENLABS_PILOT_LOCAL_TOKEN");
  if (!token || request.headers.get("x-kanisa-pilot-token") !== token) return false;
  const origin = requestOrigin(request);
  return origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost");
}

async function ensurePilotAuthorized(callerSupabase: ReturnType<typeof createClient>, localPilotAuthorized: boolean) {
  if (localPilotAuthorized) return;
  const { data: isSuperAdmin, error } = await callerSupabase.rpc("is_super_admin");
  if (error) throw new Error(error.message);
  if (!isSuperAdmin) throw new Error("ElevenLabs pilot requires a Super Admin.");
}

async function pilotObjectExists(supabase: ReturnType<typeof createClient>, path: string) {
  const prefix = path.split("/").slice(0, -1).join("/");
  const filename = path.split("/").at(-1) ?? path;
  const { data, error } = await supabase.storage.from(BIBLE_AUDIO_PILOT_BUCKET).list(prefix, {
    limit: 10,
    search: filename,
  });
  if (error) throw new Error(error.message);
  return Boolean(data?.some((item) => item.name === filename));
}

async function handlePilotRequest(params: {
  supabase: ReturnType<typeof createClient>;
  callerSupabase: ReturnType<typeof createClient>;
  request: Request;
  pilotRequest: PilotAudioRequest;
  elevenLabsApiKey?: string;
  voiceConfig: VoiceConfig;
  elevenLabsModel: string;
  bibleAudioVersion: string;
  localPilotAuthorized: boolean;
  context: PilotSafeContext;
}) {
  const {
    supabase,
    callerSupabase,
    request,
    pilotRequest,
    elevenLabsApiKey,
    voiceConfig,
    elevenLabsModel,
    bibleAudioVersion,
    localPilotAuthorized,
    context,
  } = params;

  try {
    await ensurePilotAuthorized(callerSupabase, localPilotAuthorized);
    pilotLog("auth_completed", context);
  } catch (_error) {
    throw new PilotStageError({
      status: 403,
      stage: "auth_completed",
      errorCode: "PILOT_AUTHORIZATION_FAILED",
      message: "ElevenLabs pilot authorization failed.",
    });
  }

  context.voiceSource = voiceConfig.source;
  context.voiceIdRedacted = voiceConfig.redacted;

  if (!voiceConfig.voiceId) {
    throw new PilotStageError({
      status: 500,
      stage: "secrets_validated",
      errorCode: "MISSING_ELEVENLABS_VOICE_ID",
      message: "Bible Audio pilot voice is not configured.",
    });
  }
  if (!pilotRequest.dryRun && !elevenLabsApiKey) {
    throw new PilotStageError({
      status: 500,
      stage: "secrets_validated",
      errorCode: "MISSING_ELEVENLABS_API_KEY",
      message: "ElevenLabs API key is not configured.",
    });
  }
  pilotLog("secrets_validated", context, {
    api_key_present: Boolean(elevenLabsApiKey),
    voice_id_present: Boolean(voiceConfig.voiceId),
    voice_source: voiceConfig.source,
    voice_id_redacted: voiceConfig.redacted,
    audio_version_present: Boolean(bibleAudioVersion),
  });

  if (pilotRequest.diagnostic) {
    pilotLog("response_returned", context, { diagnostic: true, estimated_api_requests: 0 });
    return jsonResponse(200, {
      ok: true,
      success: true,
      diagnostic: true,
      dryRun: true,
      provider: "elevenlabs",
      voiceSource: voiceConfig.source,
      voiceIdRedacted: voiceConfig.redacted,
      modelId: elevenLabsModel,
      audioVersion: bibleAudioVersion,
      estimatedApiRequests: 0,
    });
  }

  const path = pilotStoragePath(voiceConfig.voiceId, pilotRequest.testId);
  if (path.includes("open bible") || path.includes("extracted")) {
    throw new PilotStageError({
      status: 400,
      stage: "pilot_validation_completed",
      errorCode: "INVALID_PILOT_PATH",
      message: "Pilot output path cannot target Open.Bible audio.",
    });
  }

  const metadataPath = path.replace(/\.mp3$/i, ".json");
  pilotLog("duplicate_check_started", context);
  let existingOutput = false;
  try {
    existingOutput = await pilotObjectExists(supabase, path);
    pilotLog("duplicate_check_completed", context, { existing_output: existingOutput });
  } catch (_error) {
    throw new PilotStageError({
      status: 500,
      stage: "duplicate_check_completed",
      errorCode: "PILOT_BUCKET_CHECK_FAILED",
      message: "Could not verify the ElevenLabs pilot output bucket.",
      retryable: true,
    });
  }
  const metadata = {
    test_id: pilotRequest.testId,
    provider: "elevenlabs",
    voice_id: voiceConfig.voiceId,
    voice_id_redacted: voiceConfig.redacted,
    voice_source: voiceConfig.source,
    model_id: elevenLabsModel,
    character_count: pilotRequest.text.length,
    audio_version: bibleAudioVersion,
    generated_at: null as string | null,
    dry_run: pilotRequest.dryRun,
    destination_bucket: BIBLE_AUDIO_PILOT_BUCKET,
    destination_path: path,
  };

  if (pilotRequest.dryRun) {
    pilotLog("response_returned", context, { estimated_api_requests: 0 });
    return jsonResponse(200, {
      ok: true,
      success: true,
      dryRun: true,
      provider: "elevenlabs",
      characterCount: pilotRequest.text.length,
      voiceSource: voiceConfig.source,
      voiceIdRedacted: voiceConfig.redacted,
      modelId: elevenLabsModel,
      destinationBucket: BIBLE_AUDIO_PILOT_BUCKET,
      destinationPath: pilotStoragePath(voiceConfig.redacted, pilotRequest.testId),
      existingOutput,
      estimatedApiRequests: 0,
    });
  }

  if (!pilotRequest.confirmBillableGeneration) {
    throw new PilotStageError({
      status: 400,
      stage: "pilot_validation_completed",
      errorCode: "BILLABLE_CONFIRMATION_REQUIRED",
      message: "Pilot generation requires confirmBillableGeneration=true.",
    });
  }
  if (existingOutput) {
    throw new PilotStageError({
      status: 409,
      stage: "duplicate_check_completed",
      errorCode: "PILOT_OUTPUT_ALREADY_EXISTS",
      message: "Pilot output already exists.",
    });
  }

  let providerResponse: Response;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const providerUrl = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`);
    providerUrl.searchParams.set("output_format", "mp3_44100_128");

    pilotLog("elevenlabs_request_started", context, {
      output_format: "mp3_44100_128",
      estimated_api_requests: 1,
    });
    providerResponse = await fetch(providerUrl, {
      method: "POST",
      signal: abortController.signal,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey,
      },
      body: JSON.stringify({
        model_id: elevenLabsModel,
        text: pilotRequest.text,
      }),
    });
    pilotLog("elevenlabs_response_received", context, { provider_status: providerResponse.status });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    throw new PilotStageError({
      status: isTimeout ? 504 : 502,
      stage: "elevenlabs_request_started",
      errorCode: isTimeout ? "ELEVENLABS_REQUEST_TIMEOUT" : "ELEVENLABS_REQUEST_FAILED",
      message: isTimeout ? "ElevenLabs pilot request timed out." : "ElevenLabs pilot request failed before a response was received.",
      retryable: isTimeout,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!providerResponse.ok) {
    try {
      await providerResponse.text();
    } catch (_error) {
      // Discard provider bodies; they may contain implementation details.
    }
    throw new PilotStageError({
      status: providerResponse.status === 429 ? 429 : providerResponse.status >= 500 ? 502 : 400,
      stage: "elevenlabs_response_received",
      errorCode: "ELEVENLABS_PROVIDER_ERROR",
      message: `ElevenLabs pilot request failed with status ${providerResponse.status}.`,
      providerStatus: providerResponse.status,
      retryable: providerResponse.status === 429 || providerResponse.status >= 500,
    });
  }

  let audioBytes: Uint8Array;
  try {
    audioBytes = new Uint8Array(await providerResponse.arrayBuffer());
  } catch (_error) {
    throw new PilotStageError({
      status: 502,
      stage: "elevenlabs_response_received",
      errorCode: "ELEVENLABS_AUDIO_READ_FAILED",
      message: "Could not read ElevenLabs pilot audio response.",
      retryable: true,
    });
  }
  if (audioBytes.byteLength === 0) {
    throw new PilotStageError({
      status: 502,
      stage: "elevenlabs_response_received",
      errorCode: "ELEVENLABS_EMPTY_AUDIO",
      message: "ElevenLabs returned an empty pilot audio response.",
      providerStatus: providerResponse.status,
    });
  }

  pilotLog("audio_upload_started", context, { byte_size: audioBytes.byteLength });
  const upload = await supabase.storage.from(BIBLE_AUDIO_PILOT_BUCKET).upload(path, audioBytes, {
    contentType: "audio/mpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (upload.error) {
    throw new PilotStageError({
      status: 500,
      stage: "audio_upload_started",
      errorCode: "PILOT_AUDIO_UPLOAD_FAILED",
      message: "Could not upload ElevenLabs pilot audio.",
      retryable: true,
    });
  }
  pilotLog("audio_upload_completed", context, { byte_size: audioBytes.byteLength });

  const generatedMetadata = { ...metadata, generated_at: new Date().toISOString(), dry_run: false };
  pilotLog("metadata_upload_started", context);
  const metadataUpload = await supabase.storage.from(BIBLE_AUDIO_PILOT_BUCKET).upload(
    metadataPath,
    JSON.stringify(generatedMetadata, null, 2),
    {
      contentType: "application/json",
      cacheControl: "3600",
      upsert: false,
    },
  );
  if (metadataUpload.error) {
    throw new PilotStageError({
      status: 500,
      stage: "metadata_upload_started",
      errorCode: "PILOT_METADATA_UPLOAD_FAILED",
      message: "Pilot audio was created but metadata upload failed. Inspect the pilot bucket before retrying.",
      retryable: false,
    });
  }
  pilotLog("metadata_upload_completed", context);

  pilotLog("response_returned", context, { estimated_api_requests: 1 });
  return jsonResponse(200, {
    ok: true,
    success: true,
    dryRun: false,
    provider: "elevenlabs",
    characterCount: pilotRequest.text.length,
    voiceSource: voiceConfig.source,
    voiceIdRedacted: voiceConfig.redacted,
    modelId: elevenLabsModel,
    destinationBucket: BIBLE_AUDIO_PILOT_BUCKET,
    destinationPath: pilotStoragePath(voiceConfig.redacted, pilotRequest.testId),
    metadataPath: pilotStoragePath(voiceConfig.redacted, pilotRequest.testId).replace(/\.mp3$/i, ".json"),
    existingOutput: false,
    estimatedApiRequests: 1,
  });
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
  const pilotContext: PilotSafeContext = { startedAt: Date.now() };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    const voiceConfig = resolveElevenLabsVoiceConfig();
    const elevenLabsModel = Deno.env.get("ELEVENLABS_MODEL_ID") ?? "eleven_multilingual_v2";
    const bibleAudioVersion = Deno.env.get("BIBLE_AUDIO_VERSION") ?? BIBLE_AUDIO_VERSION;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Bible audio backend is not configured.");
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

    if (isPilotRequest(parsedBody)) {
      const record = parsedBody as Record<string, unknown>;
      pilotContext.testId = typeof record.testId === "string" ? record.testId : undefined;
      pilotContext.dryRun = record.dryRun === true;
      pilotContext.characterCount = typeof record.text === "string" ? record.text.length : undefined;
      pilotContext.modelId = elevenLabsModel;
      pilotContext.voiceSource = voiceConfig.source;
      pilotContext.voiceIdRedacted = voiceConfig.redacted;
      pilotLog("request_received", pilotContext);
    }

    const authorization = request.headers.get("Authorization") ?? "";
    const callerSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const localPilotAuthorized = isPilotRequest(parsedBody) && isLocalPilotInvocation(request);
    if (isPilotRequest(parsedBody)) pilotLog("auth_started", pilotContext, { local_pilot_authorized: localPilotAuthorized });
    const { data: userData, error: userError } = await callerSupabase.auth.getUser();
    if ((userError || !userData.user) && !localPilotAuthorized) {
      if (isPilotRequest(parsedBody)) {
        throw new PilotStageError({
          status: 401,
          stage: "auth_completed",
          errorCode: "PILOT_AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
        });
      }
      return jsonResponse(401, { success: false, error: "Authentication is required." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    serviceSupabase = supabase;

    if (isPilotRequest(parsedBody)) {
      let pilotRequest: PilotAudioRequest;
      try {
        pilotRequest = normalizePilotRequest(parsedBody);
      } catch (error) {
        throw new PilotStageError({
          status: 400,
          stage: "pilot_validation_completed",
          errorCode: "PILOT_VALIDATION_FAILED",
          message: error instanceof Error ? error.message : "Pilot request validation failed.",
        });
      }
      pilotContext.testId = pilotRequest.testId;
      pilotContext.dryRun = pilotRequest.dryRun;
      pilotContext.characterCount = pilotRequest.text.length;
      pilotLog("pilot_validation_completed", pilotContext);
      return await handlePilotRequest({
        supabase,
        callerSupabase,
        request,
        pilotRequest,
        elevenLabsApiKey,
        voiceConfig,
        elevenLabsModel,
        bibleAudioVersion,
        localPilotAuthorized,
        context: pilotContext,
      });
    }

    let audioRequest = normalizeRequest(parsedBody);

    const { data: currentContext, error: contextError } = await callerSupabase
      .rpc("get_current_user_context");
    if (contextError) throw new Error(contextError.message);
    const roleContext = currentContext as { church_id?: string | null } | null;

    if (!roleContext?.church_id) {
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
      .eq("church_id", roleContext.church_id)
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
      .select("id, chapter_number")
      .eq("book_id", audioRequest.bookId)
      .eq("chapter_number", audioRequest.chapterNumber)
      .maybeSingle();

    if (chapterError) throw new Error(chapterError.message);
    if (!chapter) return jsonResponse(404, { success: false, error: "Invalid chapter." });

    const { data: officialAudio, error: officialAudioError } = await supabase
      .from("bible_audio_assets")
      .select("id, storage_path")
      .eq("translation_id", audioRequest.translationId)
      .eq("book_id", audioRequest.bookId)
      .eq("chapter_number", audioRequest.chapterNumber)
      .eq("language_code", audioRequest.languageCode)
      .eq("provider", "Open.Bible")
      .eq("provider_model", "official-human")
      .eq("status", "ready")
      .not("storage_path", "is", null)
      .maybeSingle();

    if (officialAudioError) throw new Error(officialAudioError.message);
    if (officialAudio?.storage_path) {
      return jsonResponse(200, {
        success: true,
        cached: true,
        source: "official",
        provider: "Open.Bible",
        audioUrl: await signedAudioUrl(supabase, officialAudio.storage_path, request),
        expiresIn: 60 * 30,
      });
    }

    if (!voiceConfig.voiceId) {
      return jsonResponse(500, {
        success: false,
        error: "Bible Audio voice is not configured.",
        error_code: "MISSING_ELEVENLABS_VOICE_ID",
      });
    }

    audioRequest = applyProviderConfig(audioRequest, voiceConfig.voiceId, bibleAudioVersion, elevenLabsModel);

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
        source: "ai-cache",
        provider: "elevenlabs",
        audioUrl: await signedAudioUrl(supabase, cachedAudio.storage_path, request),
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
      requested_by: userData.user!.id,
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

    const narrationText = buildBibleNarrationText({
      translation,
      book,
      chapter,
      verses,
    });
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
      source: "ai-generated",
      provider: "elevenlabs",
      audioUrl: await signedAudioUrl(supabase, path, request),
      expiresIn: 60 * 30,
    });
  } catch (error) {
    if (error instanceof PilotStageError) {
      return pilotFailureResponse(error, pilotContext);
    }
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
