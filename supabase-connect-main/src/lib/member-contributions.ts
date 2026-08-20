import { supabase } from "@/integrations/supabase/client";

export const MEMBER_CONTRIBUTION_PAGE_SIZE = 20;

export async function fetchMemberContributionTotal(churchId: string, memberId: string) {
  const { data, error } = await supabase
    .from("contributions")
    .select("amount")
    .eq("church_id", churchId)
    .eq("member_id", memberId);

  if (error) throw error;

  return (data ?? []).reduce((total, row) => {
    const amount = Number(row.amount ?? 0);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export type MemberContribution = {
  id: string;
  amount: number;
  date: string;
  created_at: string;
  notes: string | null;
  payment_reference: string | null;
  category_id: string | null;
  church_id: string;
  member_id: string | null;
  donor_name: string | null;
  contribution_categories: { name: string | null } | null;
};

export async function fetchMemberContributionPage(churchId: string, memberId: string, page: number) {
  const from = page * MEMBER_CONTRIBUTION_PAGE_SIZE;
  const to = from + MEMBER_CONTRIBUTION_PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from("contributions")
    .select("id, amount, date, created_at, notes, payment_reference, category_id, church_id, member_id, donor_name, contribution_categories!contributions_category_id_fkey(name)", { count: "exact" })
    .eq("church_id", churchId)
    .eq("member_id", memberId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { records: (data ?? []) as MemberContribution[], count: count ?? 0 };
}

export async function fetchMemberContributionReceipt(contributionId: string, churchId: string, memberId: string) {
  const { data, error } = await supabase
    .from("contributions")
    .select("id, amount, date, created_at, notes, payment_reference, category_id, church_id, member_id, donor_name, contribution_categories!contributions_category_id_fkey(name)")
    .eq("id", contributionId)
    .eq("church_id", churchId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) throw error;
  return data as MemberContribution | null;
}

export function contributionDisplayReference(contribution: Pick<MemberContribution, "id" | "payment_reference">) {
  return contribution.payment_reference?.trim() || `KC-${contribution.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}
