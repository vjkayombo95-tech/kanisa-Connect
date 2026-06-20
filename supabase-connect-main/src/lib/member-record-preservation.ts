import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const RECORD_PRESERVATION_AMOUNT = 3000;
export const RECORD_PRESERVATION_YEARLY_AMOUNT = 30000;
export const RECORD_PRESERVATION_PAGE_SIZE = 25;

export type MemberRecordSubscription = {
  id: string;
  church_id: string;
  member_id: string;
  amount: number;
  plan_interval: "monthly" | "yearly";
  status: "pending" | "active" | "expired" | "rejected";
  start_date: string | null;
  end_date: string | null;
  transaction_id: string | null;
  proof_url: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export function isCurrentMonthDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function hasActiveRecordPreservation(subscription: MemberRecordSubscription | null | undefined) {
  return subscription?.status === "active" && !!subscription.end_date && new Date(subscription.end_date) > new Date();
}

export function useMemberRecordPreservation(memberId: string | undefined, churchId: string | null | undefined) {
  return useQuery({
    queryKey: ["member-record-preservation", memberId, churchId],
    queryFn: async () => {
      if (!memberId || !churchId) return { active: null, latest: null };

      const { data, error } = await supabase
        .from("member_record_subscriptions" as never)
        .select("*")
        .eq("member_id", memberId)
        .eq("church_id", churchId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        if (error.message?.includes("member_record_subscriptions")) return { active: null, latest: null };
        throw error;
      }

      const subscriptions = (data ?? []) as unknown as MemberRecordSubscription[];
      const active = subscriptions.find(hasActiveRecordPreservation) ?? null;
      return {
        active,
        latest: subscriptions[0] ?? null,
      };
    },
    enabled: !!memberId && !!churchId,
    staleTime: 60 * 1000,
  });
}
