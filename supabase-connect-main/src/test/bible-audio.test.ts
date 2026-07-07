import { readFileSync, readdirSync, statSync } from "node:fs";
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
  audioVersion: "rc-3.0.0",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return fullPath;
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
    expect(buildBibleAudioCacheKey(cacheRequest)).toBe("translation-1:book-1:3:sw:voice-a:rc-3.0.0");
    expect(buildBibleAudioCacheKey({ ...cacheRequest })).toBe(buildBibleAudioCacheKey(cacheRequest));
    expect(buildBibleAudioStoragePath(cacheRequest)).toBe("translation-1/sw/voice-a/rc-3.0.0/book-1-3.mp3");
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
    const providerCall = edgeFunctionSource.indexOf("api.elevenlabs.io");

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

  it("keeps provider secrets out of browser source", () => {
    const frontendText = sourceFiles(path.join(root, "src"))
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
      .filter((file) => !file.includes(`${path.sep}test${path.sep}`))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(frontendText).not.toContain("ELEVENLABS_API_KEY");
    expect(frontendText).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edgeFunctionSource).toContain("Deno.env.get(\"ELEVENLABS_API_KEY\")");
  });

  it("adds localized English and Kiswahili member player labels", () => {
    expect(en.member_portal.bible.audio.listen).toBe("Listen");
    expect(sw.member_portal.bible.audio.listen).toBe("Sikiliza");
    expect(en.member_portal.bible.audio.auto_play_next).toBeTruthy();
    expect(sw.member_portal.bible.audio.auto_play_next).toBeTruthy();
  });

  it("preserves the existing Bible reader while adding mobile-friendly audio controls", () => {
    expect(chapterSource).toContain("MemberBibleChapterPage");
    expect(chapterSource).toContain("BibleAudioPlayer");
    expect(chapterSource).toContain("isBibleAudioVisible");
    expect(chapterSource).not.toContain("voiceId:");
    expect(chapterSource).not.toContain("audioVersion:");
    expect(playerSource).toContain("sm:flex-row");
    expect(playerSource).toContain("Slider");
    expect(playerSource).toContain("Select");
    expect(playerSource).toContain("Checkbox");
  });
});
