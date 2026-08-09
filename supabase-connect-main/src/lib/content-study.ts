import { supabase } from "@/integrations/supabase/client";

export type ContentStudyType = "bible" | "daily_reading" | "prayer" | "saint" | "homily" | "catechism" | (string & {});
export type HighlightColor = "yellow" | "green" | "blue" | "purple" | "pink" | "orange";

export const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "blue", "purple", "pink", "orange"];

export type ContentStudyTarget = {
  contentType: ContentStudyType;
  contentId: string;
  segmentId?: string | null;
  userId?: string | null;
  churchId?: string | null;
  reference?: string | null;
  excerpt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ContentBookmark = ContentStudyTarget & {
  id: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentHighlight = ContentStudyTarget & {
  id: string;
  color: HighlightColor;
  createdAt: string;
  updatedAt: string;
};

export type ContentNote = ContentStudyTarget & {
  id: string;
  title: string | null;
  body: string;
  bodyFormat: "plain" | "markdown" | "rich_text";
  createdAt: string;
  updatedAt: string;
};

export type ContentFavorite = ContentStudyTarget & {
  id: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentStudySegmentState = {
  bookmarked?: boolean;
  favorite?: boolean;
  highlightColor?: HighlightColor | null;
  noteCount?: number;
};

type StudyTable = "content_bookmarks" | "content_highlights" | "content_notes" | "content_favorites";
type AnyStudyRow = Record<string, unknown>;
type StudyQueryResult = { data?: unknown[] | null; error?: unknown | null };
type StudyDeleteResult = { error?: unknown | null };
type StudyListQuery = {
  eq: (column: string, value: unknown) => StudyListQuery;
  order: (column: string, options: { ascending: boolean }) => Promise<StudyQueryResult>;
};
type StudyDeleteQuery = PromiseLike<StudyDeleteResult> & {
  eq: (column: string, value: unknown) => StudyDeleteQuery;
  is: (column: string, value: unknown) => StudyDeleteQuery;
};

function normalizeTarget(target: ContentStudyTarget) {
  return {
    user_id: target.userId,
    church_id: target.churchId ?? null,
    content_type: target.contentType,
    content_id: target.contentId,
    segment_id: target.segmentId ?? null,
    reference: target.reference ?? null,
    excerpt: target.excerpt ?? null,
    metadata: target.metadata ?? {},
  };
}

function fromRowTarget(row: AnyStudyRow): ContentStudyTarget {
  return {
    userId: row.user_id as string,
    churchId: (row.church_id as string | null) ?? null,
    contentType: row.content_type as ContentStudyType,
    contentId: row.content_id as string,
    segmentId: (row.segment_id as string | null) ?? null,
    reference: (row.reference as string | null) ?? null,
    excerpt: (row.excerpt as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

function bookmarkFromRow(row: AnyStudyRow): ContentBookmark {
  return {
    ...fromRowTarget(row),
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function highlightFromRow(row: AnyStudyRow): ContentHighlight {
  return {
    ...fromRowTarget(row),
    id: row.id as string,
    color: row.color as HighlightColor,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function noteFromRow(row: AnyStudyRow): ContentNote {
  return {
    ...fromRowTarget(row),
    id: row.id as string,
    title: (row.title as string | null) ?? null,
    body: row.body as string,
    bodyFormat: (row.body_format as ContentNote["bodyFormat"]) ?? "plain",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function favoriteFromRow(row: AnyStudyRow): ContentFavorite {
  return {
    ...fromRowTarget(row),
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function fallbackKey(table: StudyTable, userId: string | null | undefined, contentType: string, contentId: string) {
  return `kanisa:content-study:${table}:${userId ?? "anonymous"}:${contentType}:${contentId}`;
}

function readFallbackRows(table: StudyTable, target: ContentStudyTarget): AnyStudyRow[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(fallbackKey(table, target.userId, target.contentType, target.contentId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AnyStudyRow[];
  } catch {
    window.localStorage.removeItem(fallbackKey(table, target.userId, target.contentType, target.contentId));
    return [];
  }
}

function writeFallbackRows(table: StudyTable, target: ContentStudyTarget, rows: AnyStudyRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(fallbackKey(table, target.userId, target.contentType, target.contentId), JSON.stringify(rows));
}

async function listRows(table: StudyTable, target: ContentStudyTarget): Promise<AnyStudyRow[]> {
  if (!target.userId) return readFallbackRows(table, target);
  let query = supabase
    .from(table as never)
    .select("*")
    .eq("user_id" as never, target.userId as never)
    .eq("content_type" as never, target.contentType as never)
    .eq("content_id" as never, target.contentId as never) as unknown as StudyListQuery;

  if (target.segmentId) query = query.eq("segment_id", target.segmentId);
  const result = await query.order("created_at", { ascending: false });
  if (result.error) return readFallbackRows(table, target);
  return (result.data ?? []) as AnyStudyRow[];
}

async function insertRow(table: StudyTable, target: ContentStudyTarget, payload: AnyStudyRow): Promise<AnyStudyRow> {
  const now = new Date().toISOString();
  const optimistic = {
    id: `local-${crypto.randomUUID?.() ?? Date.now()}`,
    ...normalizeTarget(target),
    ...payload,
    created_at: now,
    updated_at: now,
  };
  if (!target.userId) {
    const rows = [optimistic, ...readFallbackRows(table, target)];
    writeFallbackRows(table, target, rows);
    return optimistic;
  }

  const result = await supabase.from(table as never).insert(optimistic as never).select("*").single();
  if (result.error) {
    const rows = [optimistic, ...readFallbackRows(table, target)];
    writeFallbackRows(table, target, rows);
    return optimistic;
  }
  return result.data as unknown as AnyStudyRow;
}

async function deleteRows(table: StudyTable, target: ContentStudyTarget) {
  if (!target.userId) {
    writeFallbackRows(
      table,
      target,
      readFallbackRows(table, target).filter((row) => row.segment_id !== (target.segmentId ?? null)),
    );
    return;
  }
  let query = supabase
    .from(table as never)
    .delete()
    .eq("user_id" as never, target.userId as never)
    .eq("content_type" as never, target.contentType as never)
    .eq("content_id" as never, target.contentId as never) as unknown as StudyDeleteQuery;
  query = target.segmentId ? query.eq("segment_id", target.segmentId) : query.is("segment_id", null);
  const result = await query;
  if (result.error) {
    writeFallbackRows(
      table,
      target,
      readFallbackRows(table, target).filter((row) => row.segment_id !== (target.segmentId ?? null)),
    );
  }
}

export const BookmarkService = {
  async list(target: ContentStudyTarget) {
    return (await listRows("content_bookmarks", target)).map(bookmarkFromRow);
  },
  async add(target: ContentStudyTarget, label?: string | null) {
    return bookmarkFromRow(await insertRow("content_bookmarks", target, { label: label ?? target.reference ?? null }));
  },
  async remove(target: ContentStudyTarget) {
    await deleteRows("content_bookmarks", target);
  },
  async toggle(target: ContentStudyTarget, current?: boolean) {
    const exists = current ?? (await this.list(target)).some((item) => (item.segmentId ?? null) === (target.segmentId ?? null));
    if (exists) {
      await this.remove(target);
      return null;
    }
    return this.add(target);
  },
};

export const HighlightService = {
  async list(target: ContentStudyTarget) {
    return (await listRows("content_highlights", target)).map(highlightFromRow);
  },
  async set(target: ContentStudyTarget, color: HighlightColor) {
    await deleteRows("content_highlights", target);
    return highlightFromRow(await insertRow("content_highlights", target, { color }));
  },
  async remove(target: ContentStudyTarget) {
    await deleteRows("content_highlights", target);
  },
};

export const NotesService = {
  async list(target: ContentStudyTarget) {
    return (await listRows("content_notes", target)).map(noteFromRow);
  },
  async add(target: ContentStudyTarget, body: string, title?: string | null) {
    return noteFromRow(await insertRow("content_notes", target, { title: title ?? null, body, body_format: "plain" }));
  },
  async remove(id: string) {
    const result = await supabase.from("content_notes" as never).delete().eq("id" as never, id as never);
    if (result.error) throw result.error;
  },
};

export const FavoritesService = {
  async list(target: ContentStudyTarget) {
    return (await listRows("content_favorites", target)).map(favoriteFromRow);
  },
  async add(target: ContentStudyTarget, label?: string | null) {
    return favoriteFromRow(await insertRow("content_favorites", target, { label: label ?? target.reference ?? null }));
  },
  async remove(target: ContentStudyTarget) {
    await deleteRows("content_favorites", target);
  },
  async toggle(target: ContentStudyTarget, current?: boolean) {
    const exists = current ?? (await this.list(target)).some((item) => (item.segmentId ?? null) === (target.segmentId ?? null));
    if (exists) {
      await this.remove(target);
      return null;
    }
    return this.add(target);
  },
};
