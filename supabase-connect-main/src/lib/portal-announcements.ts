import { supabase } from "@/integrations/supabase/client";
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
};

function isMissingRpc(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = `${record.message ?? ""} ${record.details ?? ""} ${record.hint ?? ""}`.toLowerCase();

  return record.code === "PGRST202" || text.includes("schema cache") || text.includes("could not find the function");
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

      if (!isMissingRpc(error)) {
        throw error;
      }

      console.warn("Portal announcements RPC unavailable; using direct Supabase fallback:", error);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("announcements")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_published", true)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fallbackError) throw fallbackError;

      return ((fallbackData ?? []) as PortalAnnouncementRecord[]);
    },
    readOfflineCache(cacheKey, [] as PortalAnnouncementRecord[]),
  );
}
