import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAudioBookmark,
  deleteAudioBookmark,
  loadAudioBookmarks,
  loadAudioContent,
  loadAudioContentById,
  loadAudioHistory,
  loadAudioProgress,
  loadAudioTracks,
  recordAudioHistory,
  saveAudioProgress,
} from "@/lib/universal-audio";
import type {
  AudioContentFilters,
  CreateAudioBookmarkInput,
  RecordAudioHistoryInput,
  SaveAudioProgressInput,
} from "@/types/universal-audio";

export const universalAudioKeys = {
  all: ["universal-audio"] as const,
  contentList: (filters: AudioContentFilters) => [...universalAudioKeys.all, "content", filters] as const,
  contentDetail: (contentId: string | null | undefined) => [...universalAudioKeys.all, "content-detail", contentId] as const,
  tracks: (contentId: string | null | undefined) => [...universalAudioKeys.all, "tracks", contentId] as const,
  progress: (userId: string | null | undefined, contentId: string | null | undefined, trackId?: string | null) =>
    [...universalAudioKeys.all, "progress", userId, contentId, trackId ?? null] as const,
  bookmarks: (userId: string | null | undefined, contentId?: string | null) =>
    [...universalAudioKeys.all, "bookmarks", userId, contentId ?? null] as const,
  history: (userId: string | null | undefined, contentId?: string | null) =>
    [...universalAudioKeys.all, "history", userId, contentId ?? null] as const,
};

export function useAudioContent(filters: AudioContentFilters) {
  return useQuery({
    queryKey: universalAudioKeys.contentList(filters),
    queryFn: () => loadAudioContent(filters),
    enabled: !!filters.churchId,
  });
}

export function useAudioContentDetail(contentId: string | null | undefined) {
  return useQuery({
    queryKey: universalAudioKeys.contentDetail(contentId),
    queryFn: () => (contentId ? loadAudioContentById(contentId) : Promise.resolve(null)),
    enabled: !!contentId,
  });
}

export function useAudioTracks(contentId: string | null | undefined) {
  return useQuery({
    queryKey: universalAudioKeys.tracks(contentId),
    queryFn: () => (contentId ? loadAudioTracks(contentId) : Promise.resolve([])),
    enabled: !!contentId,
  });
}

export function useAudioProgress(params: {
  userId: string | null | undefined;
  contentId: string | null | undefined;
  trackId?: string | null;
}) {
  return useQuery({
    queryKey: universalAudioKeys.progress(params.userId, params.contentId, params.trackId),
    queryFn: () =>
      params.userId && params.contentId
        ? loadAudioProgress({ userId: params.userId, contentId: params.contentId, trackId: params.trackId })
        : Promise.resolve(null),
    enabled: !!params.userId && !!params.contentId,
  });
}

export function useSaveAudioProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAudioProgressInput) => saveAudioProgress(input),
    onSuccess: (progress) => {
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.progress(progress.user_id, progress.content_id, progress.track_id) });
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.history(progress.user_id, progress.content_id) });
    },
  });
}

export function useAudioBookmarks(params: {
  userId: string | null | undefined;
  contentId?: string | null;
}) {
  return useQuery({
    queryKey: universalAudioKeys.bookmarks(params.userId, params.contentId),
    queryFn: () =>
      params.userId
        ? loadAudioBookmarks({ userId: params.userId, contentId: params.contentId ?? undefined })
        : Promise.resolve([]),
    enabled: !!params.userId,
  });
}

export function useCreateAudioBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAudioBookmarkInput) => createAudioBookmark(input),
    onSuccess: (bookmark) => {
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.bookmarks(bookmark.user_id, bookmark.content_id) });
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.bookmarks(bookmark.user_id) });
    },
  });
}

export function useDeleteAudioBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookmarkId: string) => deleteAudioBookmark(bookmarkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.all });
    },
  });
}

export function useAudioHistory(params: {
  userId: string | null | undefined;
  contentId?: string | null;
  limit?: number;
}) {
  return useQuery({
    queryKey: universalAudioKeys.history(params.userId, params.contentId),
    queryFn: () =>
      params.userId
        ? loadAudioHistory({ userId: params.userId, contentId: params.contentId ?? undefined, limit: params.limit })
        : Promise.resolve([]),
    enabled: !!params.userId,
  });
}

export function useRecordAudioHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordAudioHistoryInput) => recordAudioHistory(input),
    onSuccess: (history) => {
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.history(history.user_id, history.content_id) });
      queryClient.invalidateQueries({ queryKey: universalAudioKeys.history(history.user_id) });
    },
  });
}
