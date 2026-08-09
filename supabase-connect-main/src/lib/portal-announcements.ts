import { supabase } from "@/integrations/supabase/client";
import { logSupabaseError } from "@/lib/error-logger";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";

export type PortalAnnouncementRecord = {
  id: string;
  church_id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  status?: string | null;
  featured?: boolean | null;
  publish_at?: string | null;
  expires_at?: string | null;
  audience?: string[] | null;
  category?: string | null;
  show_on_calendar?: boolean | null;
};

export function getPortalAnnouncementsCache(churchId: string | null | undefined, limit = 50) {
  if (!churchId) return [] as PortalAnnouncementRecord[];
  return readOfflineCache(`offline-cache:portal-announcements-latest:${churchId}:${limit}`, [] as PortalAnnouncementRecord[]);
}

export async function fetchPortalAnnouncements(churchId: string | null | undefined, limit = 50) {
  if (!churchId) return [];
  const cacheKey = `offline-cache:portal-announcements-latest:${churchId}:${limit}`;

  return withOfflineCache(
    cacheKey,
    async () => {
      const { data, error } = await supabase.rpc("get_portal_announcements" as never, {
        _church_id: churchId,
        _limit: limit,
      } as never);

      if (!error) {
        return ((data ?? []) as PortalAnnouncementRecord[]);
      }

      logSupabaseError(error, {
        function: "fetchPortalAnnouncements",
        operation: "rpc",
        rpc: "get_portal_announcements",
        church_id: churchId,
      });

      const now = new Date().toISOString();
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("announcements")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_published", true)
        .is("archived_at", null)
        .or(`publish_at.is.null,publish_at.lte.${now}`)
        .or(`never_expires.eq.true,expires_at.is.null,expires_at.gt.${now}`)
        .order("featured", { ascending: false })
        .order("publish_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fallbackError) throw fallbackError;

      return ((fallbackData ?? []) as PortalAnnouncementRecord[]);
    },
    readOfflineCache(cacheKey, [] as PortalAnnouncementRecord[]),
  );
}
