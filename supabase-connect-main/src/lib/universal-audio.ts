import { supabase } from "@/integrations/supabase/client";
import type {
  AudioContentFilters,
  CreateAudioBookmarkInput,
  RecordAudioHistoryInput,
  SaveAudioProgressInput,
  UniversalAudioBookmark,
  UniversalAudioContent,
  UniversalAudioHistory,
  UniversalAudioProgress,
  UniversalAudioTrack,
} from "@/types/universal-audio";

const AUDIO_CONTENT_SELECT = "*";
const AUDIO_TRACK_SELECT = "*";
const AUDIO_PROGRESS_SELECT = "*";
const AUDIO_BOOKMARK_SELECT = "*";
const AUDIO_HISTORY_SELECT = "*";

function table(name: string) {
  return supabase.from(name as never);
}

export async function loadAudioContent(filters: AudioContentFilters): Promise<UniversalAudioContent[]> {
  let query = table("audio_content")
    .select(AUDIO_CONTENT_SELECT)
    .eq("church_id" as never, filters.churchId as never)
    .order("published_at" as never, { ascending: false, nullsFirst: false })
    .order("created_at" as never, { ascending: false });

  if (filters.contentType && filters.contentType !== "all") {
    query = query.eq("content_type" as never, filters.contentType as never);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status" as never, filters.status as never);
  }
  if (filters.search?.trim()) {
    query = query.or(`title.ilike.%${filters.search.trim()}%,subtitle.ilike.%${filters.search.trim()}%` as never);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as UniversalAudioContent[];
}

export async function loadAudioContentById(contentId: string): Promise<UniversalAudioContent | null> {
  const { data, error } = await table("audio_content")
    .select(AUDIO_CONTENT_SELECT)
    .eq("id" as never, contentId as never)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as UniversalAudioContent | null;
}

export async function loadAudioTracks(contentId: string): Promise<UniversalAudioTrack[]> {
  const { data, error } = await table("audio_tracks")
    .select(AUDIO_TRACK_SELECT)
    .eq("content_id" as never, contentId as never)
    .eq("status" as never, "published" as never)
    .order("track_number" as never, { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as UniversalAudioTrack[];
}

export async function loadAudioProgress(params: {
  userId: string;
  contentId: string;
  trackId?: string | null;
}): Promise<UniversalAudioProgress | null> {
  let query = table("audio_progress")
    .select(AUDIO_PROGRESS_SELECT)
    .eq("user_id" as never, params.userId as never)
    .eq("content_id" as never, params.contentId as never);

  query = params.trackId
    ? query.eq("track_id" as never, params.trackId as never)
    : query.is("track_id" as never, null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as UniversalAudioProgress | null;
}

export async function saveAudioProgress(input: SaveAudioProgressInput): Promise<UniversalAudioProgress> {
  const payload = {
    user_id: input.userId,
    church_id: input.churchId,
    content_id: input.contentId,
    track_id: input.trackId ?? null,
    position_seconds: input.positionSeconds,
    duration_seconds: input.durationSeconds ?? null,
    completed: input.completed ?? false,
    completed_at: input.completed ? new Date().toISOString() : null,
    last_played_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };

  if (!input.trackId) {
    const existing = await loadAudioProgress({
      userId: input.userId,
      contentId: input.contentId,
      trackId: null,
    });
    if (existing) {
      const { data, error } = await table("audio_progress")
        .update(payload as never)
        .eq("id" as never, existing.id as never)
        .select(AUDIO_PROGRESS_SELECT)
        .single();

      if (error) throw error;
      return data as unknown as UniversalAudioProgress;
    }
  }

  const { data, error } = await table("audio_progress")
    .upsert(payload as never, { onConflict: "user_id,content_id,track_id" })
    .select(AUDIO_PROGRESS_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as UniversalAudioProgress;
}

export async function loadAudioBookmarks(params: {
  userId: string;
  contentId?: string;
}): Promise<UniversalAudioBookmark[]> {
  let query = table("audio_bookmarks")
    .select(AUDIO_BOOKMARK_SELECT)
    .eq("user_id" as never, params.userId as never)
    .order("created_at" as never, { ascending: false });

  if (params.contentId) {
    query = query.eq("content_id" as never, params.contentId as never);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as UniversalAudioBookmark[];
}

export async function createAudioBookmark(input: CreateAudioBookmarkInput): Promise<UniversalAudioBookmark> {
  const { data, error } = await table("audio_bookmarks")
    .insert({
      user_id: input.userId,
      church_id: input.churchId,
      content_id: input.contentId,
      track_id: input.trackId ?? null,
      position_seconds: input.positionSeconds,
      label: input.label ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
    } as never)
    .select(AUDIO_BOOKMARK_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as UniversalAudioBookmark;
}

export async function deleteAudioBookmark(bookmarkId: string): Promise<void> {
  const { error } = await table("audio_bookmarks").delete().eq("id" as never, bookmarkId as never);
  if (error) throw error;
}

export async function loadAudioHistory(params: {
  userId: string;
  contentId?: string;
  limit?: number;
}): Promise<UniversalAudioHistory[]> {
  let query = table("audio_history")
    .select(AUDIO_HISTORY_SELECT)
    .eq("user_id" as never, params.userId as never)
    .order("created_at" as never, { ascending: false })
    .limit(params.limit ?? 50);

  if (params.contentId) {
    query = query.eq("content_id" as never, params.contentId as never);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as UniversalAudioHistory[];
}

export async function recordAudioHistory(input: RecordAudioHistoryInput): Promise<UniversalAudioHistory> {
  const { data, error } = await table("audio_history")
    .insert({
      user_id: input.userId,
      church_id: input.churchId,
      content_id: input.contentId,
      track_id: input.trackId ?? null,
      event_type: input.eventType,
      position_seconds: input.positionSeconds ?? 0,
      duration_seconds: input.durationSeconds ?? null,
      session_id: input.sessionId ?? null,
      metadata: input.metadata ?? {},
    } as never)
    .select(AUDIO_HISTORY_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as UniversalAudioHistory;
}
