import {
  downloadAnalyticsReportPdf,
  type AnalyticsReportBranding,
} from "@/components/church-admin/AnalyticsReportPdf";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsIntentType =
  | "top_contributors"
  | "monthly_report"
  | "category_breakdown"
  | "summary_report";

export type AnalyticsDateRange = "current_month" | "last_month" | "year_to_date" | "all_time";

export type AnalyticsCategory = "all" | "tithe" | "offering" | "building" | "missions" | "youth";

export type ContributorSummary = {
  name: string;
  total: number;
  percentage: number;
};

export type CategorySummary = {
  category: string;
  total: number;
  percentage: number;
};

export type AnalyticsIntent = {
  type: AnalyticsIntentType;
  dateRange: AnalyticsDateRange;
  category: AnalyticsCategory;
};

export type AnalyticsSummary = {
  totalGiving: number;
  contributorCount: number;
  averageGift: number;
};

export type AnalyticsResponse = {
  query: string;
  intent: AnalyticsIntent;
  summary: AnalyticsSummary;
  topContributors: ContributorSummary[];
  categoryBreakdown: CategorySummary[];
  insights: string[];
  generatedAt: string;
  source: "supabase" | "mock";
  warning?: string | null;
};

type AnalyticsRow = {
  amount: number;
  created_at: string;
  donor_name: string;
  memberName: string;
  categoryName: string;
};

const DEFAULT_ASSISTANT_URL = "http://localhost:8787";
const ASSISTANT_API_BASE_PATH = "/api/analytics-assistant";
const MOCK_CONTRIBUTIONS = [
  { member: "Maria John", amount: 120000, category: "tithe", created_at: "2026-04-02T00:00:00Z" },
  { member: "Joseph Peter", amount: 85000, category: "offering", created_at: "2026-04-03T00:00:00Z" },
  { member: "Anna James", amount: 200000, category: "building", created_at: "2026-04-04T00:00:00Z" },
  { member: "David Paulo", amount: 65000, category: "missions", created_at: "2026-04-05T00:00:00Z" },
  { member: "Grace Neema", amount: 175000, category: "tithe", created_at: "2026-04-05T00:00:00Z" },
  { member: "Maria John", amount: 90000, category: "offering", created_at: "2026-03-08T00:00:00Z" },
  { member: "Joseph Peter", amount: 110000, category: "tithe", created_at: "2026-03-10T00:00:00Z" },
  { member: "Anna James", amount: 130000, category: "building", created_at: "2026-03-16T00:00:00Z" },
  { member: "Samuel Elias", amount: 95000, category: "youth", created_at: "2026-03-18T00:00:00Z" },
  { member: "Grace Neema", amount: 150000, category: "missions", created_at: "2026-03-21T00:00:00Z" },
] as const;

function getAssistantBaseUrl() {
  const configured = import.meta.env.VITE_ANALYTICS_ASSISTANT_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return DEFAULT_ASSISTANT_URL;
  }

  return "";
}

function getAssistantEndpoint(path: string) {
  const baseUrl = getAssistantBaseUrl();
  return baseUrl ? `${baseUrl}${ASSISTANT_API_BASE_PATH}${path}` : `${ASSISTANT_API_BASE_PATH}${path}`;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonth(date: Date, diff: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + diff, 1));
}

function parseIntent(query: string): AnalyticsIntent {
  const lower = query.toLowerCase();

  let type: AnalyticsIntentType = "summary_report";
  if (lower.includes("top") || lower.includes("contributor")) type = "top_contributors";
  else if (lower.includes("monthly") || lower.includes("month") || lower.includes("report")) type = "monthly_report";
  else if (lower.includes("category") || lower.includes("breakdown")) type = "category_breakdown";

  let dateRange: AnalyticsDateRange = "all_time";
  if (lower.includes("this month") || lower.includes("current month") || lower.includes("monthly report")) {
    dateRange = "current_month";
  } else if (lower.includes("last month") || lower.includes("previous month")) {
    dateRange = "last_month";
  } else if (lower.includes("year") || lower.includes("ytd")) {
    dateRange = "year_to_date";
  }

  let category: AnalyticsCategory = "all";
  if (lower.includes("tithe")) category = "tithe";
  else if (lower.includes("offering")) category = "offering";
  else if (lower.includes("building")) category = "building";
  else if (lower.includes("mission")) category = "missions";
  else if (lower.includes("youth")) category = "youth";

  return { type, dateRange, category };
}

function getRangeBounds(dateRange: AnalyticsDateRange) {
  const baseDate = new Date();
  const currentMonthStart = startOfMonth(baseDate);
  const nextMonthStart = shiftMonth(baseDate, 1);
  const lastMonthStart = shiftMonth(baseDate, -1);
  const yearStart = new Date(Date.UTC(baseDate.getUTCFullYear(), 0, 1));

  if (dateRange === "current_month") {
    return { start: currentMonthStart, end: nextMonthStart };
  }

  if (dateRange === "last_month") {
    return { start: lastMonthStart, end: currentMonthStart };
  }

  if (dateRange === "year_to_date") {
    return { start: yearStart, end: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000) };
  }

  return null;
}

function getPreviousRange(dateRange: AnalyticsDateRange): AnalyticsDateRange | null {
  if (dateRange === "current_month") return "last_month";
  return null;
}

function filterMockData(intent: AnalyticsIntent): AnalyticsRow[] {
  const bounds = getRangeBounds(intent.dateRange);

  return MOCK_CONTRIBUTIONS.filter((entry) => {
    const createdAt = new Date(entry.created_at);
    const inRange = bounds ? createdAt >= bounds.start && createdAt < bounds.end : true;
    const inCategory = intent.category === "all" ? true : entry.category === intent.category;
    return inRange && inCategory;
  }).map((entry) => ({
    amount: entry.amount,
    created_at: entry.created_at,
    donor_name: entry.member,
    memberName: entry.member,
    categoryName: entry.category,
  }));
}

function aggregateRows(filteredRows: AnalyticsRow[]) {
  const totalGiving = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const contributorTotals = filteredRows.reduce<Record<string, number>>((accumulator, row) => {
    const name = row.memberName || row.donor_name || "Anonymous";
    accumulator[name] = (accumulator[name] || 0) + Number(row.amount || 0);
    return accumulator;
  }, {});

  const categoryTotals = filteredRows.reduce<Record<string, number>>((accumulator, row) => {
    const category = row.categoryName || "Uncategorized";
    accumulator[category] = (accumulator[category] || 0) + Number(row.amount || 0);
    return accumulator;
  }, {});

  const topContributors = Object.entries(contributorTotals)
    .map(([name, total]) => ({
      name,
      total,
      percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total,
      percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
    }))
    .sort((left, right) => right.total - left.total);

  return {
    summary: {
      totalGiving,
      contributorCount: Object.keys(contributorTotals).length,
      averageGift: filteredRows.length > 0 ? totalGiving / filteredRows.length : 0,
    },
    topContributors,
    categoryBreakdown,
  };
}

function getRelationRecord(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function buildInsights(
  filteredRows: AnalyticsRow[],
  previousRows: AnalyticsRow[],
  summary: AnalyticsSummary,
  topContributors: ContributorSummary[],
  categoryBreakdown: CategorySummary[],
) {
  const insights: string[] = [];
  const previousTotal = previousRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  if (previousTotal > 0) {
    const delta = ((summary.totalGiving - previousTotal) / previousTotal) * 100;
    const direction = delta >= 0 ? "increased" : "decreased";
    insights.push(`Giving ${direction} by ${Math.abs(delta).toFixed(1)}% compared with the previous period.`);
  }

  const topFiveTotal = topContributors.slice(0, 5).reduce((sum, entry) => sum + entry.total, 0);
  if (summary.totalGiving > 0) {
    insights.push(`Top 5 members contribute ${((topFiveTotal / summary.totalGiving) * 100).toFixed(1)}% of giving.`);
  }

  if (categoryBreakdown[0]) {
    insights.push(`${categoryBreakdown[0].category} is the leading category at ${categoryBreakdown[0].percentage.toFixed(1)}% of giving.`);
  }

  if (filteredRows.length > 0) {
    const busiestDay = filteredRows.reduce<Record<string, number>>((accumulator, row) => {
      const key = row.created_at.slice(0, 10) || "Unknown date";
      accumulator[key] = (accumulator[key] || 0) + Number(row.amount || 0);
      return accumulator;
    }, {});

    const [topDate, topDateTotal] = Object.entries(busiestDay).sort((left, right) => right[1] - left[1])[0];
    insights.push(`The strongest giving day in this dataset was ${topDate} with TZS ${Number(topDateTotal).toLocaleString()}.`);
  }

  return insights;
}

function buildMockAnalyticsReport(query: string, warning: string): AnalyticsResponse {
  const intent = parseIntent(query);
  const filteredRows = filterMockData(intent);
  const previousRange = getPreviousRange(intent.dateRange);
  const previousRows = previousRange ? filterMockData({ ...intent, dateRange: previousRange }) : [];
  const { summary, topContributors, categoryBreakdown } = aggregateRows(filteredRows);

  return {
    query,
    intent,
    summary,
    topContributors,
    categoryBreakdown,
    insights: buildInsights(filteredRows, previousRows, summary, topContributors, categoryBreakdown),
    generatedAt: new Date().toISOString(),
    source: "mock",
    warning,
  };
}

async function fetchSupabaseRowsDirect(churchId: string, intent: AnalyticsIntent): Promise<AnalyticsRow[]> {
  const bounds = getRangeBounds(intent.dateRange);
  let query = supabase
    .from("contributions")
    .select(
      "amount, created_at, donor_name, church_id, members!contributions_member_id_fkey(full_name), contribution_categories!contributions_category_id_fkey(name)",
    )
    .eq("church_id", churchId)
    .order("created_at", { ascending: false });

  if (bounds) {
    query = query.gte("created_at", bounds.start.toISOString()).lt("created_at", bounds.end.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const normalized = (data || []).map((row) => ({
    amount: Number(row.amount || 0),
    created_at: row.created_at || "",
    donor_name: row.donor_name || "",
    memberName: String(getRelationRecord(row.members)?.full_name || ""),
    categoryName: String(getRelationRecord(row.contribution_categories)?.name || "Uncategorized"),
  }));

  return intent.category === "all"
    ? normalized
    : normalized.filter((row) => row.categoryName.toLowerCase().includes(intent.category.replaceAll("_", " ")));
}

async function buildSupabaseAnalyticsReport(query: string, churchId: string): Promise<AnalyticsResponse> {
  const intent = parseIntent(query);
  const filteredRows = await fetchSupabaseRowsDirect(churchId, intent);
  const previousRange = getPreviousRange(intent.dateRange);
  const previousRows = previousRange ? await fetchSupabaseRowsDirect(churchId, { ...intent, dateRange: previousRange }) : [];
  const { summary, topContributors, categoryBreakdown } = aggregateRows(filteredRows);

  return {
    query,
    intent,
    summary,
    topContributors,
    categoryBreakdown,
    insights: buildInsights(filteredRows, previousRows, summary, topContributors, categoryBreakdown),
    generatedAt: new Date().toISOString(),
    source: "supabase",
  };
}

async function getDirectSupabaseFallback(input: { query: string; churchId: string }) {
  try {
    return await buildSupabaseAnalyticsReport(input.query, input.churchId);
  } catch (error) {
    console.error("Direct Supabase analytics fallback failed:", error);
    return null;
  }
}

export async function fetchAnalyticsAssistant(input: {
  query: string;
  churchId: string;
  accessToken: string;
}) {
  try {
    const response = await fetch(getAssistantEndpoint("/query"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.error || `Analytics assistant request failed with status ${response.status}.`;
      console.error("Analytics assistant request failed:", {
        status: response.status,
        payload,
      });

      const liveReport = await getDirectSupabaseFallback(input);
      if (liveReport) {
        return liveReport;
      }

      return buildMockAnalyticsReport(input.query, `Live analytics is temporarily unavailable: ${message}`);
    }

    return (await response.json()) as AnalyticsResponse;
  } catch (error) {
    console.error("Analytics assistant connection failed, using mock fallback:", error);
    const liveReport = await getDirectSupabaseFallback(input);
    if (liveReport) {
      return liveReport;
    }

    const warning =
      error instanceof Error && error.message
        ? `Live analytics assistant is offline: ${error.message}`
        : "Live analytics assistant is offline.";
    return buildMockAnalyticsReport(input.query, warning);
  }
}

export function formatAssistantCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function exportAnalyticsPdf(report: AnalyticsResponse, branding: AnalyticsReportBranding) {
  return downloadAnalyticsReportPdf(report, branding);
}
