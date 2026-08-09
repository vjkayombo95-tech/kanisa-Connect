import type { MemberAudioVerseTiming } from "@/lib/member-audio";
import type { SynchronizationIndex, SynchronizationIndexAdapter, SynchronizationSegment } from "@/types/synchronization";

type ExistingIndexTiming = {
  verse_id?: unknown;
  start_seconds?: unknown;
  end_seconds?: unknown;
  start?: unknown;
  end?: unknown;
  text?: unknown;
  confidence?: unknown;
  words?: unknown;
  word_count?: unknown;
};

type ExistingIndexShape = {
  book?: unknown;
  chapter?: unknown;
  duration?: unknown;
  metadata?: unknown;
  timings?: ExistingIndexTiming[];
  segments?: ExistingIndexTiming[];
  words?: ExistingIndexTiming[];
};

export type BibleIndexAdapterInput = {
  contentId: string;
  trackId?: string | null;
  duration?: number | null;
  index?: ExistingIndexShape;
  indexText?: string;
  verses?: MemberAudioVerseTiming[];
  metadata?: Record<string, unknown>;
};

export type GenericTimedIndexInput = {
  contentId: string;
  trackId?: string | null;
  duration?: number | null;
  segments: SynchronizationSegment[];
  metadata?: Record<string, unknown>;
};

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrFallback(value: unknown, fallback: number) {
  return numberOrNull(value) ?? fallback;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function splitWords(segment: SynchronizationSegment): SynchronizationSegment[] {
  const tokens = segment.text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  if (!tokens.length || segment.end <= segment.start) return [];
  const step = (segment.end - segment.start) / tokens.length;
  return tokens.map((token, index) => ({
    id: `${segment.id}:word:${index + 1}`,
    type: "word",
    start: segment.start + step * index,
    end: index === tokens.length - 1 ? segment.end : segment.start + step * (index + 1),
    text: token,
    confidence: segment.confidence,
    parentId: segment.id,
    metadata: {
      ...segment.metadata,
      wordIndex: index + 1,
      generatedFromSegment: true,
    },
  }));
}

function segmentFromVerseTiming(verse: MemberAudioVerseTiming): SynchronizationSegment {
  return {
    id: `verse-${verse.verse}`,
    type: "verse",
    start: verse.start,
    end: verse.end,
    text: verse.text,
    confidence: verse.confidence,
    parentId: null,
    metadata: {
      verseNumber: verse.verse,
      duration: verse.duration,
      source: "audio_version_verses",
    },
  };
}

function segmentFromExistingTiming(timing: ExistingIndexTiming, index: number): SynchronizationSegment {
  const start = numberOrFallback(timing.start_seconds ?? timing.start, 0);
  const end = numberOrFallback(timing.end_seconds ?? timing.end, start);
  const originalId = typeof timing.verse_id === "string" ? timing.verse_id : `segment-${index + 1}`;
  const verseNumber = Number(String(originalId).replace(/[^0-9]/g, "")) || index + 1;

  return {
    id: `verse-${verseNumber}`,
    type: "verse",
    start,
    end,
    text: typeof timing.text === "string" ? timing.text : "",
    confidence: numberOrNull(timing.confidence),
    parentId: null,
    metadata: {
      verseNumber,
      source: "imported_index",
      originalId,
      wordCount: numberOrNull(timing.word_count),
    },
  };
}

function wordFromExistingTiming(timing: ExistingIndexTiming, index: number, parentId?: string): SynchronizationSegment {
  const start = numberOrFallback(timing.start_seconds ?? timing.start, 0);
  const end = numberOrFallback(timing.end_seconds ?? timing.end, start);
  return {
    id: parentId ? `${parentId}:word:${index + 1}` : `word-${index + 1}`,
    type: "word",
    start,
    end,
    text: typeof timing.text === "string" ? timing.text : "",
    confidence: numberOrNull(timing.confidence),
    parentId: parentId ?? null,
    metadata: {
      wordIndex: index + 1,
      source: "imported_index",
    },
  };
}

export class BibleIndexAdapter implements SynchronizationIndexAdapter<BibleIndexAdapterInput> {
  readonly contentType = "bible";

  adapt(input: BibleIndexAdapterInput): SynchronizationIndex {
    const parsedIndex = input.index ?? (input.indexText ? JSON.parse(input.indexText) as ExistingIndexShape : null);
    const segmentRecords = parsedIndex?.timings ?? parsedIndex?.segments ?? [];
    const verseSegments = input.verses?.length ? input.verses.map(segmentFromVerseTiming) : segmentRecords.map(segmentFromExistingTiming);
    const importedWords = (parsedIndex?.words ?? []).map((word, index) => wordFromExistingTiming(word, index));
    const generatedWords = importedWords.length ? [] : verseSegments.flatMap(splitWords);
    const duration = input.duration ?? numberOrNull(parsedIndex?.duration) ?? verseSegments.at(-1)?.end ?? null;

    return {
      contentId: input.contentId,
      trackId: input.trackId ?? null,
      duration,
      segments: [...verseSegments, ...importedWords, ...generatedWords],
      metadata: {
        ...recordOrEmpty(parsedIndex?.metadata),
        ...input.metadata,
        adapter: "BibleIndexAdapter",
        book: parsedIndex?.book,
        chapter: parsedIndex?.chapter,
      },
    };
  }
}

class PassthroughTimedIndexAdapter implements SynchronizationIndexAdapter<GenericTimedIndexInput> {
  constructor(readonly contentType: string, private readonly adapterName: string) {}

  adapt(input: GenericTimedIndexInput): SynchronizationIndex {
    return {
      contentId: input.contentId,
      trackId: input.trackId ?? null,
      duration: input.duration ?? input.segments.at(-1)?.end ?? null,
      segments: input.segments,
      metadata: {
        ...input.metadata,
        adapter: this.adapterName,
      },
    };
  }
}

export class HomilyIndexAdapter extends PassthroughTimedIndexAdapter {
  constructor() {
    super("homily", "HomilyIndexAdapter");
  }
}

export class PrayerIndexAdapter extends PassthroughTimedIndexAdapter {
  constructor() {
    super("prayer", "PrayerIndexAdapter");
  }
}

export class SaintsIndexAdapter extends PassthroughTimedIndexAdapter {
  constructor() {
    super("saint", "SaintsIndexAdapter");
  }
}

export function createBibleSynchronizationIndex(input: BibleIndexAdapterInput) {
  return new BibleIndexAdapter().adapt(input);
}
