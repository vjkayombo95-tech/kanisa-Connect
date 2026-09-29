import { supabase } from "@/integrations/supabase/client";

export const MEMBER_CONTRIBUTION_PAGE_SIZE = 20;
export const MEMBER_CONTRIBUTION_TIME_ZONE = "Africa/Dar_es_Salaam";
export const MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE = 500;

export type MemberContributionRange = "today" | "this_week" | "this_month" | "all_time";

type TanzaniaDateParts = {
  year: number;
  month: number;
  day: number;
};

const tanzaniaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEMBER_CONTRIBUTION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getTanzaniaDateParts(value: Date): TanzaniaDateParts {
  const parts = tanzaniaDateFormatter.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

function addLocalDays(parts: TanzaniaDateParts, days: number): TanzaniaDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getLocalDayOfWeek(parts: TanzaniaDateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)).getUTCDay();
}

function toTanzaniaMidnightUtcIso(parts: TanzaniaDateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -3, 0, 0, 0)).toISOString();
}

export function getMemberContributionRangeBounds(range: MemberContributionRange, now = new Date()) {
  if (range === "all_time") return null;

  const today = getTanzaniaDateParts(now);

  if (range === "today") {
    return {
      startIso: toTanzaniaMidnightUtcIso(today),
      endIso: toTanzaniaMidnightUtcIso(addLocalDays(today, 1)),
    };
  }

  if (range === "this_week") {
    const mondayOffset = (getLocalDayOfWeek(today) + 6) % 7;
    const start = addLocalDays(today, -mondayOffset);
    return {
      startIso: toTanzaniaMidnightUtcIso(start),
      endIso: toTanzaniaMidnightUtcIso(addLocalDays(start, 7)),
    };
  }

  const start = { year: today.year, month: today.month, day: 1 };
  const endDate = new Date(Date.UTC(today.year, today.month, 1, 12, 0, 0, 0));
  const end = {
    year: endDate.getUTCFullYear(),
    month: endDate.getUTCMonth() + 1,
    day: 1,
  };

  return {
    startIso: toTanzaniaMidnightUtcIso(start),
    endIso: toTanzaniaMidnightUtcIso(end),
  };
}

export async function fetchMemberContributionTotalForRange(
  churchId: string,
  memberId: string,
  range: MemberContributionRange,
  now = new Date(),
) {
  const bounds = getMemberContributionRangeBounds(range, now);
  let total = 0;
  let page = 0;

  while (page < 1000) {
    const from = page * MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE;
    const to = from + MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE - 1;
    let query = supabase
      .from("contributions")
      .select("id, created_at, amount")
      .eq("church_id", churchId)
      .eq("member_id", memberId);

    if (bounds) {
      query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endIso);
    }

    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const rows = data ?? [];
    total += rows.reduce((sum, row) => {
      const amount = Number(row.amount ?? 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    if (rows.length < MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE) {
      return total;
    }

    page += 1;
  }

  throw new Error("Contribution total pagination exceeded the safety limit.");
}

export async function fetchMemberContributionTotal(churchId: string, memberId: string) {
  return fetchMemberContributionTotalForRange(churchId, memberId, "all_time");
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
