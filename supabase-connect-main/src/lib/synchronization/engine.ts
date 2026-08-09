import type {
  SynchronizationIndex,
  SynchronizationProgress,
  SynchronizationSearchResult,
  SynchronizationSegment,
  SynchronizationSegmentType,
} from "@/types/synchronization";

function normalizeTime(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function sortSegments(segments: SynchronizationSegment[]) {
  return [...segments].sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}

export class SynchronizationEngine {
  readonly index: SynchronizationIndex;
  private readonly segmentsByType = new Map<string, SynchronizationSegment[]>();
  private readonly segmentsById = new Map<string, SynchronizationSegment>();

  constructor(index: SynchronizationIndex) {
    this.index = {
      ...index,
      segments: sortSegments(index.segments),
    };

    for (const segment of this.index.segments) {
      this.segmentsById.set(segment.id, segment);
      const list = this.segmentsByType.get(segment.type) ?? [];
      list.push(segment);
      this.segmentsByType.set(segment.type, list);
    }

    for (const [type, segments] of this.segmentsByType) {
      this.segmentsByType.set(type, sortSegments(segments));
    }
  }

  segmentAt(time: number, type?: SynchronizationSegmentType): SynchronizationSegment | null {
    const segments = this.getSegments(type);
    const target = normalizeTime(time);
    let low = 0;
    let high = segments.length - 1;
    let candidate: SynchronizationSegment | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const segment = segments[mid];
      if (segment.start <= target) {
        candidate = segment;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (!candidate) return null;
    return target >= candidate.start && target <= candidate.end ? candidate : null;
  }

  currentSegment(time: number, type: SynchronizationSegmentType = "verse") {
    return this.segmentAt(time, type);
  }

  currentWord(time: number) {
    return this.segmentAt(time, "word");
  }

  timestampFor(segmentId: string) {
    return this.segmentsById.get(segmentId)?.start ?? null;
  }

  next(time: number, type: SynchronizationSegmentType = "verse") {
    const segments = this.getSegments(type);
    const target = normalizeTime(time);
    let low = 0;
    let high = segments.length - 1;
    let result: SynchronizationSegment | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const segment = segments[mid];
      if (segment.start > target) {
        result = segment;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return result;
  }

  previous(time: number, type: SynchronizationSegmentType = "verse") {
    const segments = this.getSegments(type);
    const target = normalizeTime(time);
    let low = 0;
    let high = segments.length - 1;
    let result: SynchronizationSegment | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const segment = segments[mid];
      if (segment.end < target) {
        result = segment;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  seekToSegment(segmentId: string) {
    return this.timestampFor(segmentId);
  }

  seekToTimestamp(time: number) {
    return normalizeTime(time);
  }

  progress(time: number): SynchronizationProgress {
    const duration = this.index.duration;
    const currentTime = normalizeTime(time);
    const ratio = duration && duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    return { currentTime, duration, ratio, percent: ratio * 100 };
  }

  search(query: string, type?: SynchronizationSegmentType): SynchronizationSearchResult[] {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    return this.getSegments(type)
      .map((segment) => {
        const text = normalizeText(segment.text);
        if (!text) return { segment, score: 0 };
        if (text.includes(normalizedQuery)) return { segment, score: 1 };
        const queryTokens = new Set(normalizedQuery.split(" "));
        const textTokens = new Set(text.split(" "));
        const overlap = [...queryTokens].filter((token) => textTokens.has(token)).length;
        return { segment, score: overlap / Math.max(queryTokens.size, 1) };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.segment.start - right.segment.start);
  }

  getSegments(type?: SynchronizationSegmentType) {
    return type ? this.segmentsByType.get(type) ?? [] : this.index.segments;
  }
}
