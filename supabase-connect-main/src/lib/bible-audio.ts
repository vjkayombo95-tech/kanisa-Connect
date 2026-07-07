export const BIBLE_AUDIO_FEATURE_KEY = "bible_audio";
export const BIBLE_AUDIO_BUCKET = "bible-audio";
export const BIBLE_AUDIO_VERSION = "rc-3.0.0";
export const DEFAULT_BIBLE_AUDIO_VOICE_ID = "kanisa-default-sw";

export type BibleAudioRequest = {
  translationId: string;
  bookId: string;
  chapterNumber: number;
  languageCode: string;
  voiceId?: string | null;
  audioVersion?: string | null;
};

export type BibleAudioFeatureState = {
  exists?: boolean;
  enabled: boolean;
  visible: boolean;
  locked?: boolean;
};

export type BibleAudioTranslationState = {
  audio_generation_allowed?: boolean | null;
};

export function isBibleAudioVisible(feature: BibleAudioFeatureState, translation?: BibleAudioTranslationState | null) {
  return Boolean(feature.exists && feature.visible && feature.enabled && !feature.locked && translation?.audio_generation_allowed === true);
}

export function normalizeBibleAudioRequest(input: unknown): BibleAudioRequest {
  if (!input || typeof input !== "object") {
    throw new Error("Bible audio request must be an object.");
  }

  const record = input as Record<string, unknown>;
  if ("text" in record || "narrationText" in record || "verseText" in record || "voiceId" in record || "audioVersion" in record) {
    throw new Error("Member supplied narration text or provider identity is not accepted.");
  }

  const translationId = normalizeIdentifier(record.translationId, "translationId");
  const bookId = normalizeIdentifier(record.bookId, "bookId");
  const chapterNumber = normalizeChapterNumber(record.chapterNumber);
  const languageCode = normalizeLanguageCode(record.languageCode);
  return {
    translationId,
    bookId,
    chapterNumber,
    languageCode,
  };
}

export function buildBibleAudioCacheKey(request: BibleAudioRequest) {
  return [
    request.translationId,
    request.bookId,
    String(request.chapterNumber),
    request.languageCode.toLowerCase(),
    request.voiceId || DEFAULT_BIBLE_AUDIO_VOICE_ID,
    request.audioVersion || BIBLE_AUDIO_VERSION,
  ].join(":");
}

export function buildBibleAudioStoragePath(request: BibleAudioRequest) {
  const voiceId = sanitizePathSegment(request.voiceId || DEFAULT_BIBLE_AUDIO_VOICE_ID);
  const audioVersion = sanitizePathSegment(request.audioVersion || BIBLE_AUDIO_VERSION);
  return [
    sanitizePathSegment(request.translationId),
    sanitizePathSegment(request.languageCode.toLowerCase()),
    voiceId,
    audioVersion,
    `${sanitizePathSegment(request.bookId)}-${request.chapterNumber}.mp3`,
  ].join("/");
}

function normalizeIdentifier(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function normalizeChapterNumber(value: unknown) {
  const chapterNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    throw new Error("chapterNumber must be a positive integer.");
  }
  return chapterNumber;
}

function normalizeLanguageCode(value: unknown) {
  if (typeof value !== "string" || !/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(value.trim())) {
    throw new Error("languageCode must be a valid language code.");
  }
  return value.trim();
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
