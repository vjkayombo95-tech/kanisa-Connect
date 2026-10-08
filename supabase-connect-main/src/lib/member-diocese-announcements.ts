import { supabase } from "@/integrations/supabase/client";
import { logSupabaseError } from "@/lib/error-logger";

export type MemberDioceseAnnouncement = {
  id: string;
  diocese_id: string;
  church_id: string;
  diocese_name: string;
  title: string;
  content: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  target_mode: "all_parishes" | "selected_parishes";
  source: "diocese";
};

export async function fetchMemberDioceseAnnouncements(
  churchId: string | null | undefined,
  limit = 50,
): Promise<MemberDioceseAnnouncement[]> {
  if (!churchId) return [];

  const { data, error } = await supabase.rpc(
    "get_member_diocese_announcements" as never,
    {
      _church_id: churchId,
      _limit: limit,
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "fetchMemberDioceseAnnouncements",
      operation: "rpc",
      rpc: "get_member_diocese_announcements",
      church_id: churchId,
    });

    throw error;
  }

  return ((data ?? []) as MemberDioceseAnnouncement[]).map((announcement) => ({
    ...announcement,
    source: "diocese",
  }));
}
