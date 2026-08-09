export type SynchronizationSegmentType =
  | "verse"
  | "word"
  | "paragraph"
  | "chapter"
  | "section"
  | "sentence"
  | "heading"
  | "custom"
  | (string & {});

export type SynchronizationSegment = {
  id: string;
  type: SynchronizationSegmentType;
  start: number;
  end: number;
  text: string;
  confidence: number | null;
  parentId?: string | null;
  metadata: Record<string, unknown>;
};

export type SynchronizationIndex = {
  contentId: string;
  trackId: string | null;
  duration: number | null;
  segments: SynchronizationSegment[];
  metadata: Record<string, unknown>;
};

export type SynchronizationProgress = {
  currentTime: number;
  duration: number | null;
  ratio: number;
  percent: number;
};

export type SynchronizationSearchResult = {
  segment: SynchronizationSegment;
  score: number;
};

export type SynchronizationProvider = {
  load(): Promise<SynchronizationIndex>;
  currentSegment(time: number, type?: SynchronizationSegmentType): SynchronizationSegment | null;
  currentWord(time: number): SynchronizationSegment | null;
  segmentAt(time: number, type?: SynchronizationSegmentType): SynchronizationSegment | null;
  timestampFor(segmentId: string): number | null;
  next(time: number, type?: SynchronizationSegmentType): SynchronizationSegment | null;
  previous(time: number, type?: SynchronizationSegmentType): SynchronizationSegment | null;
  search(query: string, type?: SynchronizationSegmentType): SynchronizationSearchResult[];
  progress(time: number): SynchronizationProgress;
};

export type SynchronizationIndexAdapter<TInput = unknown> = {
  readonly contentType: string;
  adapt(input: TInput): SynchronizationIndex;
};
