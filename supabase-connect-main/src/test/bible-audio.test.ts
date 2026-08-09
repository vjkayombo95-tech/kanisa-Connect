import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import {
  BIBLE_AUDIO_FEATURE_KEY,
  buildBibleAudioCacheKey,
  buildBibleAudioStoragePath,
  isBibleAudioVisible,
  normalizeBibleAudioRequest,
} from "@/lib/bible-audio";

const root = process.cwd();
const edgeFunctionSource = readFileSync(path.join(root, "supabase/functions/generate-bible-audio/index.ts"), "utf8");
const migrationSource = readFileSync(path.join(root, "supabase/migrations/20260706110000_bible_audio_infrastructure.sql"), "utf8");
const chapterSource = readFileSync(path.join(root, "src/pages/portal/MemberBibleChapterPage.tsx"), "utf8");
const readerSource = readFileSync(path.join(root, "src/pages/portal/BibleReaderPage.tsx"), "utf8");
const bottomMiniPlayerSource = readFileSync(path.join(root, "src/components/bible/reader/BottomMiniPlayer.tsx"), "utf8");
const playerSource = readFileSync(path.join(root, "src/components/bible/BibleAudioPlayer.tsx"), "utf8");

const validRequest = {
  translationId: "translation-1",
  bookId: "book-1",
  chapterNumber: 3,
  languageCode: "sw",
};

const cacheRequest = {
  ...validRequest,
  voiceId: "voice-a",
  audioVersion: "rc-3.4.0",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "test" || entry.name === "__tests__") return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("Bible Audio infrastructure", () => {
  it("keeps Bible Audio hidden unless the platform feature exists, is enabled, and the translation is eligible", () => {
    expect(isBibleAudioVisible({ exists: false, enabled: true, visible: true }, { audio_generation_allowed: true })).toBe(false);
    expect(isBibleAudioVisible({ exists: true, enabled: false, visible: false }, { audio_generation_allowed: true })).toBe(false);
    expect(isBibleAudioVisible({ exists: true, enabled: true, visible: true }, { audio_generation_allowed: false })).toBe(false);
    expect(isBibleAudioVisible({ exists: true, enabled: true, visible: true }, { audio_generation_allowed: true })).toBe(true);
  });

  it("rejects arbitrary member narration text and invalid chapter requests", () => {
    expect(() => normalizeBibleAudioRequest({ ...validRequest, text: "Read this instead" })).toThrow("Member supplied narration text");
    expect(() => normalizeBibleAudioRequest({ ...validRequest, voiceId: "voice-b" })).toThrow("provider identity");
    expect(() => normalizeBibleAudioRequest({ ...validRequest, chapterNumber: 0 })).toThrow("chapterNumber");
  });

  it("builds deterministic cache identity and private storage paths", () => {
    expect(buildBibleAudioCacheKey(cacheRequest)).toBe("translation-1:book-1:3:sw:voice-a:rc-3.4.0");
    expect(buildBibleAudioCacheKey({ ...cacheRequest })).toBe(buildBibleAudioCacheKey(cacheRequest));
    expect(buildBibleAudioStoragePath(cacheRequest)).toBe("translation-1/sw/voice-a/rc-3.4.0/book-1-3.mp3");
  });

  it("registers Bible Audio as disabled by default and keeps sw-biblica ineligible", () => {
    expect(BIBLE_AUDIO_FEATURE_KEY).toBe("bible_audio");
    expect(migrationSource).toContain("'bible_audio'");
    expect(migrationSource).toContain("false");
    expect(migrationSource).toContain("where code = 'sw-biblica'");
    expect(migrationSource).toContain("audio_generation_allowed = false");
  });

  it("enforces backend gates before any ElevenLabs provider call can occur", () => {
    const featureCheck = edgeFunctionSource.indexOf(".eq(\"key\", BIBLE_AUDIO_FEATURE_KEY)");
    const eligibilityCheck = edgeFunctionSource.indexOf("audio_generation_allowed !== true");
    const cacheCheck = edgeFunctionSource.indexOf(".from(\"bible_audio_assets\")");
    const providerCall = edgeFunctionSource.lastIndexOf("api.elevenlabs.io");

    expect(featureCheck).toBeGreaterThan(-1);
    expect(eligibilityCheck).toBeGreaterThan(featureCheck);
    expect(cacheCheck).toBeGreaterThan(eligibilityCheck);
    expect(providerCall).toBeGreaterThan(cacheCheck);
    expect(edgeFunctionSource).toContain("Member supplied narration text or provider identity is not accepted");
    expect(edgeFunctionSource).toContain("Bible Audio is disabled");
    expect(edgeFunctionSource).toContain("Invalid book");
    expect(edgeFunctionSource).toContain("Invalid chapter");
  });

  it("reuses ready cached audio and blocks duplicate in-flight generation", () => {
    expect(edgeFunctionSource).toContain("cachedAudio?.status === \"ready\"");
    expect(edgeFunctionSource).toContain("createSignedUrl(path, 60 * 30)");
    expect(edgeFunctionSource).toContain("Bible Audio generation is already in progress");
    expect(migrationSource).toContain("cache_key text not null unique");
    expect(migrationSource).toContain("unique (translation_id, book_id, chapter_number, language_code, voice_id, audio_version, provider_model)");
    expect(edgeFunctionSource).toContain("status: \"failed\"");
    expect(edgeFunctionSource).toContain("STALE_GENERATION_MS");
    expect(edgeFunctionSource).toContain("providerUrl.searchParams.set(\"output_format\", \"mp3_44100_128\")");
    expect(edgeFunctionSource).toContain("PROVIDER_TIMEOUT_MS");
  });

  it("prefers official Open.Bible audio before cached or generated AI audio", () => {
    const officialLookup = edgeFunctionSource.indexOf(".eq(\"provider\", \"Open.Bible\")");
    const officialModel = edgeFunctionSource.indexOf(".eq(\"provider_model\", \"official-human\")");
    const aiConfig = edgeFunctionSource.indexOf("audioRequest = applyProviderConfig");
    const cachedLookup = edgeFunctionSource.indexOf(".eq(\"cache_key\", cacheKey)");
    const providerCall = edgeFunctionSource.lastIndexOf("api.elevenlabs.io");

    expect(officialLookup).toBeGreaterThan(-1);
    expect(officialModel).toBeGreaterThan(officialLookup);
    expect(edgeFunctionSource).toContain("source: \"official\"");
    expect(edgeFunctionSource).toContain("source: \"ai-cache\"");
    expect(edgeFunctionSource).toContain("source: \"ai-generated\"");
    expect(aiConfig).toBeGreaterThan(officialLookup);
    expect(cachedLookup).toBeGreaterThan(officialLookup);
    expect(providerCall).toBeGreaterThan(officialLookup);
  });

  it("routes provider text through the narration engine before ElevenLabs", () => {
    const narrationBuild = edgeFunctionSource.indexOf("buildBibleNarrationText");
    const providerPayload = edgeFunctionSource.indexOf("text: narrationText");
    const providerCall = edgeFunctionSource.indexOf("api.elevenlabs.io");

    expect(edgeFunctionSource).toContain("../_shared/bible-narration.ts");
    expect(narrationBuild).toBeGreaterThan(-1);
    expect(providerPayload).toBeGreaterThan(narrationBuild);
    expect(providerCall).toBeGreaterThan(narrationBuild);
    expect(edgeFunctionSource).not.toContain("`${verse.verse_number}. ${verse.verse_text}`");
  });

  it("keeps provider secrets out of browser source", () => {
    const frontendText = [
      ...sourceFiles(path.join(root, "src")),
      path.join(root, "vite.config.ts"),
      path.join(root, "index.html"),
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(frontendText).not.toContain("ELEVENLABS_API_KEY");
    expect(frontendText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeFunctionSource).toContain("Deno.env.get(\"ELEVENLABS_API_KEY\")");
  });

  it("adds a controlled ElevenLabs pilot lane without enabling normal Bible generation", () => {
    expect(edgeFunctionSource).toContain("PILOT_MAX_TEXT_CHARS = 500");
    expect(edgeFunctionSource).toContain("BIBLE_AUDIO_PILOT_BUCKET = \"bible-audio-pilot\"");
    expect(edgeFunctionSource).toContain("pilot=true");
    expect(edgeFunctionSource).toContain("confirmBillableGeneration=true");
    expect(edgeFunctionSource).toContain("Pilot audio accepts one supplied text sample only");
    expect(edgeFunctionSource).toContain("book, chapter, and verse inputs are rejected");
    expect(edgeFunctionSource).toContain("Pilot output path cannot target Open.Bible audio");
    expect(edgeFunctionSource).toContain("ElevenLabs pilot requires a Super Admin");
    expect(edgeFunctionSource).toContain("ELEVENLABS_PILOT_LOCAL_TOKEN");
    expect(edgeFunctionSource).toContain("dryRun: true");
    expect(edgeFunctionSource).toContain("estimatedApiRequests: 0");
    expect(edgeFunctionSource).toContain("estimatedApiRequests: 1");
    expect(edgeFunctionSource).toContain("metadataPath");
    expect(edgeFunctionSource).toContain("voice_id_redacted");
    expect(edgeFunctionSource).toContain("resolveElevenLabsVoiceConfig");
    expect(edgeFunctionSource).toContain("voiceSource");
    expect(edgeFunctionSource).toContain("diagnostic: true");
    expect(edgeFunctionSource).toContain("MISSING_ELEVENLABS_VOICE_ID");
    expect(edgeFunctionSource).not.toContain("console.log(elevenLabsApiKey");
  });

  it("returns structured pilot errors and safe stage diagnostics for billable generation", () => {
    [
      "request_received",
      "auth_started",
      "auth_completed",
      "pilot_validation_completed",
      "secrets_validated",
      "duplicate_check_started",
      "duplicate_check_completed",
      "elevenlabs_request_started",
      "elevenlabs_response_received",
      "audio_upload_started",
      "audio_upload_completed",
      "metadata_upload_started",
      "metadata_upload_completed",
      "response_returned",
      "request_failed",
    ].forEach((stage) => expect(edgeFunctionSource).toContain(stage));
    expect(edgeFunctionSource).toContain("PilotStageError");
    expect(edgeFunctionSource).toContain("error_code");
    expect(edgeFunctionSource).toContain("provider_status");
    expect(edgeFunctionSource).toContain("retryable");
    expect(edgeFunctionSource).toContain("ELEVENLABS_PROVIDER_ERROR");
    expect(edgeFunctionSource).toContain("PILOT_AUDIO_UPLOAD_FAILED");
    expect(edgeFunctionSource).toContain("PILOT_METADATA_UPLOAD_FAILED");
    expect(edgeFunctionSource).toContain("await providerResponse.text()");
    expect(edgeFunctionSource).toContain("await providerResponse.arrayBuffer()");
    expect(edgeFunctionSource).not.toContain("authorization_header");
    expect(edgeFunctionSource).not.toContain("console.info(serviceRoleKey");
    expect(edgeFunctionSource).not.toContain("console.info(elevenLabsApiKey");
  });

  it("adds localized English and Kiswahili member player labels", () => {
    expect(en.member_portal.bible.audio.listen).toBe("Listen");
    expect(sw.member_portal.bible.audio.listen).toBe("Sikiliza");
    expect(en.member_portal.bible.audio.auto_play_next).toBeTruthy();
    expect(sw.member_portal.bible.audio.auto_play_next).toBeTruthy();
  });

  it("preserves the Bible chapter route while the premium reader hosts reusable audio UI", () => {
    expect(chapterSource).toContain("MemberBibleChapterPage");
    expect(chapterSource).toContain("BibleReaderPage");
    expect(readerSource).toContain("getApprovedBibleChapterAudio");
    expect(readerSource).not.toContain("SyncedBibleAudioPlayer");
    expect(bottomMiniPlayerSource).toContain("MiniAudioPlayer");
    expect(bottomMiniPlayerSource).toContain("seekRequest");
    expect(readerSource).not.toContain("voiceId:");
    expect(readerSource).not.toContain("audioVersion:");
    expect(playerSource).toContain("sm:flex-row");
    expect(playerSource).toContain("Slider");
    expect(playerSource).toContain("Select");
    expect(playerSource).toContain("Checkbox");
  });
});
