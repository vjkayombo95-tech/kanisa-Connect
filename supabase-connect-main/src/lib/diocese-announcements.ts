import { supabase } from "@/integrations/supabase/client";
import { logSupabaseError } from "@/lib/error-logger";

export type DioceseAnnouncementStatus = "draft" | "published" | "archived";
export type DioceseAnnouncementTargetMode =
  | "all_parishes"
  | "selected_parishes";

export type DioceseAnnouncementParishTarget = {
  church_id: string;
  church_name: string;
  church_code: string | null;
};

export type DioceseAnnouncement = {
  id: string;
  diocese_id: string;
  title: string;
  content: string;
  status: DioceseAnnouncementStatus;
  target_mode: DioceseAnnouncementTargetMode;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  target_count: number;
  parish_targets: DioceseAnnouncementParishTarget[];
};

export type SaveDioceseAnnouncementInput = {
  dioceseId: string;
  announcementId?: string | null;
  title: string;
  content: string;
  status: Extract<DioceseAnnouncementStatus, "draft" | "published">;
  targetMode: DioceseAnnouncementTargetMode;
  targetChurchIds?: string[];
};

export async function getDioceseAnnouncements(
  dioceseId: string,
): Promise<DioceseAnnouncement[]> {
  const { data, error } = await supabase.rpc(
    "get_diocese_announcements" as never,
    {
      _diocese_id: dioceseId,
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "getDioceseAnnouncements",
      operation: "rpc",
      rpc: "get_diocese_announcements",
    });

    throw error;
  }

  return (data ?? []) as DioceseAnnouncement[];
}

export async function saveDioceseAnnouncement(
  input: SaveDioceseAnnouncementInput,
): Promise<{ id: string; status: DioceseAnnouncementStatus }> {
  const { data, error } = await supabase.rpc(
    "save_diocese_announcement" as never,
    {
      _diocese_id: input.dioceseId,
      _announcement_id: input.announcementId ?? null,
      _title: input.title,
      _content: input.content,
      _status: input.status,
      _target_mode: input.targetMode,
      _target_church_ids: input.targetChurchIds ?? [],
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "saveDioceseAnnouncement",
      operation: "rpc",
      rpc: "save_diocese_announcement",
    });

    throw error;
  }

  return data as { id: string; status: DioceseAnnouncementStatus };
}

export async function publishDioceseAnnouncement(
  dioceseId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "publish_diocese_announcement" as never,
    {
      _diocese_id: dioceseId,
      _announcement_id: announcementId,
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "publishDioceseAnnouncement",
      operation: "rpc",
      rpc: "publish_diocese_announcement",
    });

    throw error;
  }
}

export async function archiveDioceseAnnouncement(
  dioceseId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    "archive_diocese_announcement" as never,
    {
      _diocese_id: dioceseId,
      _announcement_id: announcementId,
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "archiveDioceseAnnouncement",
      operation: "rpc",
      rpc: "archive_diocese_announcement",
    });

    throw error;
  }
}
