import { supabase } from "@/integrations/supabase/client";

export const MEMBER_NOTIFICATION_LIMIT = 25;

export type MemberNotification = {
  id: string;
  church_id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  is_read: boolean;
  created_at: string;
};

export const memberNotificationsKey = (userId?: string | null, churchId?: string | null) =>
  ["member-notifications", userId, churchId] as const;

export function boundedUnreadLabel(notifications: readonly MemberNotification[]) {
  const count = notifications.filter((notification) => !notification.is_read).length;
  return count > 9 ? "9+" : count ? String(count) : null;
}

export async function fetchMemberNotifications(userId: string, churchId: string): Promise<MemberNotification[]> {
  if (!userId || !churchId) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id,church_id,user_id,title,message,type,is_read,created_at")
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .limit(MEMBER_NOTIFICATION_LIMIT);

  if (error) throw error;
  const rows = (data ?? []) as MemberNotification[];
  if (rows.some((row) => row.user_id !== userId || row.church_id !== churchId)) {
    throw new Error("Notification ownership could not be verified.");
  }
  return rows;
}

export async function markMemberNotificationRead(notificationId: string, userId: string, churchId: string) {
  if (!notificationId || !userId || !churchId) throw new Error("Notification ownership is unavailable.");

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .select("id,user_id,church_id,is_read")
    .maybeSingle();

  if (error) throw error;
  if (!data || data.id !== notificationId || data.user_id !== userId || data.church_id !== churchId || data.is_read !== true) {
    throw new Error("Notification was not marked as read.");
  }
  return data.id;
}
