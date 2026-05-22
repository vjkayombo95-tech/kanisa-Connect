import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PledgeRecord = {
  id: string;
  member_id: string;
  member_name: string;
  church_id: string;
  community_id: string | null;
  community_name: string | null;
  amount_pledged: number;
  amount_paid: number;
  balance: number;
  status: "pending" | "partial" | "completed";
  created_at: string;
};

export type ChurchPledgeSummary = {
  community_id: string;
  community_name: string;
  target_amount: number;
  total_pledged: number;
  total_paid: number;
  balance: number;
  pledge_count: number;
  completed_count: number;
  progress_percentage: number;
};

type CreatePledgeArgs = {
  memberId: string;
  churchId: string;
  communityId?: string | null;
  amountPledged: number;
  targetAmount?: number | null;
};

type MakePaymentArgs = {
  pledgeId: string;
  amount: number;
  paymentMethod: string;
};

export function getPledgeProgress(record: Pick<PledgeRecord, "amount_pledged" | "amount_paid">) {
  if (!record.amount_pledged) return 0;
  return Math.max(0, Math.min(100, Number(((record.amount_paid / record.amount_pledged) * 100).toFixed(1))));
}

export function useMemberPledges(memberId?: string | null) {
  return useQuery({
    queryKey: ["member-pledges", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase.rpc("get_member_pledges" as never, { _member_id: memberId } as never);
      if (error) throw error;
      return ((data ?? []) as any[]).map(mapPledgeRecord);
    },
    enabled: !!memberId,
  });
}

export function useCommunityPledges(communityId?: string | null) {
  return useQuery({
    queryKey: ["community-pledges", communityId],
    queryFn: async () => {
      if (!communityId) return [];
      const { data, error } = await supabase.rpc("get_community_pledges" as never, { _community_id: communityId } as never);
      if (error) throw error;
      return ((data ?? []) as any[]).map(mapPledgeRecord);
    },
    enabled: !!communityId,
  });
}

export function useChurchPledgesSummary(churchId?: string | null) {
  return useQuery({
    queryKey: ["church-pledges-summary", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_pledges_summary" as never, { _church_id: churchId } as never);
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => ({
        community_id: row.community_id,
        community_name: row.community_name,
        target_amount: Number(row.target_amount ?? 0),
        total_pledged: Number(row.total_pledged ?? 0),
        total_paid: Number(row.total_paid ?? 0),
        balance: Number(row.balance ?? 0),
        pledge_count: Number(row.pledge_count ?? 0),
        completed_count: Number(row.completed_count ?? 0),
        progress_percentage: Number(row.progress_percentage ?? 0),
      })) as ChurchPledgeSummary[];
    },
    enabled: !!churchId,
  });
}

export function useCreatePledge() {
  return useMutation({
    mutationFn: async ({ memberId, churchId, communityId, amountPledged, targetAmount }: CreatePledgeArgs) => {
      const { data, error } = await supabase.rpc("create_pledge" as never, {
        _member_id: memberId,
        _church_id: churchId,
        _community_id: communityId ?? null,
        _amount_pledged: amountPledged,
        _target_amount: targetAmount ?? null,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Unable to create pledge");
      return result;
    },
  });
}

export function useMakePledgePayment() {
  return useMutation({
    mutationFn: async ({ pledgeId, amount, paymentMethod }: MakePaymentArgs) => {
      const { data, error } = await supabase.rpc("make_pledge_payment" as never, {
        _pledge_id: pledgeId,
        _amount: amount,
        _payment_method: paymentMethod,
      } as never);
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Unable to record payment");
      return result;
    },
  });
}

export function usePledgeRealtime(queryKeys: (readonly unknown[])[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    };

    const channel = supabase
      .channel("pledges-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pledge_payments" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pledges" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_targets" },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKeys]);
}

function mapPledgeRecord(row: any): PledgeRecord {
  return {
    id: row.id,
    member_id: row.member_id,
    member_name: row.member_name,
    church_id: row.church_id,
    community_id: row.community_id,
    community_name: row.community_name,
    amount_pledged: Number(row.amount_pledged ?? 0),
    amount_paid: Number(row.amount_paid ?? 0),
    balance: Number(row.balance ?? 0),
    status: row.status,
    created_at: row.created_at,
  };
}
