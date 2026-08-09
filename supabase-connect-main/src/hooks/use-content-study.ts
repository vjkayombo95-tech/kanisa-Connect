import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  BookmarkService,
  FavoritesService,
  HighlightService,
  NotesService,
  type ContentBookmark,
  type ContentFavorite,
  type ContentHighlight,
  type ContentNote,
  type ContentStudyTarget,
  type HighlightColor,
} from "@/lib/content-study";

function studyKey(kind: string, target: ContentStudyTarget) {
  return ["content-study", kind, target.userId ?? "anonymous", target.contentType, target.contentId, target.segmentId ?? "all"];
}

function mergeTarget(target: ContentStudyTarget, segmentId?: string | null): ContentStudyTarget {
  return { ...target, segmentId: segmentId ?? target.segmentId ?? null };
}

export function useBookmarks(target: ContentStudyTarget, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = studyKey("bookmarks", target);
  const query = useQuery({
    queryKey,
    queryFn: () => BookmarkService.list(target),
    enabled: enabled && !!target.contentId,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: ({ segmentId, current }: { segmentId?: string | null; current?: boolean }) => BookmarkService.toggle(mergeTarget(target, segmentId), current),
    onMutate: async ({ segmentId, current }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContentBookmark[]>(queryKey) ?? [];
      const nextSegmentId = segmentId ?? null;
      if (current) {
        queryClient.setQueryData(queryKey, previous.filter((item) => (item.segmentId ?? null) !== nextSegmentId));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, toggleBookmark: toggle.mutateAsync, isTogglingBookmark: toggle.isPending };
}

export function useHighlights(target: ContentStudyTarget, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = studyKey("highlights", target);
  const query = useQuery({
    queryKey,
    queryFn: () => HighlightService.list(target),
    enabled: enabled && !!target.contentId,
    staleTime: 30_000,
  });

  const setHighlight = useMutation({
    mutationFn: ({ segmentId, color }: { segmentId?: string | null; color: HighlightColor }) => HighlightService.set(mergeTarget(target, segmentId), color),
    onMutate: async ({ segmentId, color }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContentHighlight[]>(queryKey) ?? [];
      const nextSegmentId = segmentId ?? null;
      queryClient.setQueryData(queryKey, [
        {
          id: `optimistic-${Date.now()}`,
          ...mergeTarget(target, nextSegmentId),
          color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...previous.filter((item) => (item.segmentId ?? null) !== nextSegmentId),
      ]);
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const clearHighlight = useMutation({
    mutationFn: ({ segmentId }: { segmentId?: string | null }) => HighlightService.remove(mergeTarget(target, segmentId)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, setHighlight: setHighlight.mutateAsync, clearHighlight: clearHighlight.mutateAsync };
}

export function useNotes(target: ContentStudyTarget, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = studyKey("notes", target);
  const query = useQuery({
    queryKey,
    queryFn: () => NotesService.list(target),
    enabled: enabled && !!target.contentId,
    staleTime: 30_000,
  });

  const addNote = useMutation({
    mutationFn: ({ segmentId, body, title }: { segmentId?: string | null; body: string; title?: string | null }) => NotesService.add(mergeTarget(target, segmentId), body, title),
    onMutate: async ({ segmentId, body, title }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContentNote[]>(queryKey) ?? [];
      queryClient.setQueryData(queryKey, [
        {
          id: `optimistic-${Date.now()}`,
          ...mergeTarget(target, segmentId ?? null),
          title: title ?? null,
          body,
          bodyFormat: "plain",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...previous,
      ]);
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, addNote: addNote.mutateAsync, isAddingNote: addNote.isPending };
}

export function useFavorites(target: ContentStudyTarget, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = studyKey("favorites", target);
  const query = useQuery({
    queryKey,
    queryFn: () => FavoritesService.list(target),
    enabled: enabled && !!target.contentId,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: ({ segmentId, current }: { segmentId?: string | null; current?: boolean }) => FavoritesService.toggle(mergeTarget(target, segmentId), current),
    onMutate: async ({ segmentId, current }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContentFavorite[]>(queryKey) ?? [];
      if (current) queryClient.setQueryData(queryKey, previous.filter((item) => (item.segmentId ?? null) !== (segmentId ?? null)));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, toggleFavorite: toggle.mutateAsync, isTogglingFavorite: toggle.isPending };
}

export function useShareContent() {
  const copyText = useCallback(async (text: string) => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }, []);

  const shareContent = useCallback(async ({ title, text, url }: { title: string; text?: string; url?: string }) => {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
    return copyText([title, text, url].filter(Boolean).join("\n"));
  }, [copyText]);

  const shareTimestamp = useCallback(
    async ({ title, timestamp, url }: { title: string; timestamp: number; url?: string }) =>
      shareContent({ title, text: `${title} @ ${Math.round(timestamp)}s`, url }),
    [shareContent],
  );

  return { copyText, copyReference: copyText, shareContent, shareTimestamp };
}
