export type UniversalAudioContentType =
  | "bible_chapter"
  | "daily_reading"
  | "homily"
  | "prayer"
  | "saint"
  | "reflection"
  | "catechesis"
  | (string & {});

export type UniversalAudioStatus = "draft" | "published" | "archived";

export type UniversalAudioVisibility = "private" | "members" | "public";

export type UniversalAudioContent = {
  id: string;
  church_id: string;
  content_type: UniversalAudioContentType;
  title: string;
  subtitle: string | null;
  description: string | null;
  language_code: string;
  image_url: string | null;
  source_table: string | null;
  source_id: string | null;
  external_ref: string | null;
  metadata: Record<string, unknown>;
  visibility: UniversalAudioVisibility;
  status: UniversalAudioStatus;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UniversalAudioTrack = {
  id: string;
  church_id: string;
  content_id: string;
  title: string;
  subtitle: string | null;
  track_number: number;
  duration_seconds: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  stream_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  transcript_path: string | null;
  alignment_path: string | null;
  index_path: string | null;
  metadata: Record<string, unknown>;
  status: UniversalAudioStatus;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UniversalAudioProgress = {
  id: string;
  user_id: string;
  church_id: string;
  content_id: string;
  track_id: string | null;
  position_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  completed_at: string | null;
  last_played_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UniversalAudioBookmark = {
  id: string;
  user_id: string;
  church_id: string;
  content_id: string;
  track_id: string | null;
  position_seconds: number;
  label: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UniversalAudioHistoryEvent = "play" | "pause" | "resume" | "seek" | "complete" | "error";

export type UniversalAudioHistory = {
  id: string;
  user_id: string;
  church_id: string;
  content_id: string;
  track_id: string | null;
  event_type: UniversalAudioHistoryEvent;
  position_seconds: number;
  duration_seconds: number | null;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AudioContentFilters = {
  churchId: string;
  contentType?: UniversalAudioContentType | "all";
  status?: UniversalAudioStatus | "all";
  search?: string;
  limit?: number;
};

export type SaveAudioProgressInput = {
  userId: string;
  churchId: string;
  contentId: string;
  trackId?: string | null;
  positionSeconds: number;
  durationSeconds?: number | null;
  completed?: boolean;
  metadata?: Record<string, unknown>;
};

export type CreateAudioBookmarkInput = {
  userId: string;
  churchId: string;
  contentId: string;
  trackId?: string | null;
  positionSeconds: number;
  label?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

export type RecordAudioHistoryInput = {
  userId: string;
  churchId: string;
  contentId: string;
  trackId?: string | null;
  eventType: UniversalAudioHistoryEvent;
  positionSeconds?: number;
  durationSeconds?: number | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};
