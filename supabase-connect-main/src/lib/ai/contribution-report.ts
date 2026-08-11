import { supabase } from "@/integrations/supabase/client";
import type { KanisaAIContext } from "./types";
import type { ControlledReportType, ReportPeriod } from "./controlled-answers";

export type ContributionSummarySnapshot = {
  churchId: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  total: number;
  paymentCount: number;
  comparisonTotal: number | null;
  percentageChange: number | null;
  categories: Array<{ name: string; total: number }>;
  monthly: Array<{ month: string; total: number; count: number }>;
  generatedAt: string;
};

export type ContributionReportResult = {
  status: "success" | "forbidden" | "invalid_period" | "no_data" | "error";
  message: string;
  url?: string;
  filename?: string;
  snapshot?: ContributionSummarySnapshot;
};

const DAY_MS = 86_400_000;
const MAX_CUSTOM_DAYS = 366;

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function currentAndPreviousMonthPeriod(now = new Date()) {
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { currentStart: dateKey(currentStart), nextStart: dateKey(nextStart), previousStart: dateKey(previousStart) };
}

export function resolveReportPeriod(period: ReportPeriod, now = new Date()) {
  let start: Date;
  let endExclusive: Date;
  let label: string;
  if (period.kind === "current_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = start.toLocaleDateString("en-TZ", { month: "long", year: "numeric" });
  } else if (period.kind === "previous_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endExclusive = new Date(now.getFullYear(), now.getMonth(), 1);
    label = start.toLocaleDateString("en-TZ", { month: "long", year: "numeric" });
  } else if (period.kind === "last_n_months" && period.months === 3) {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = "Last 3 months";
  } else if (period.kind === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(period.endDate)) return null;
    start = new Date(`${period.startDate}T00:00:00`);
    const inclusiveEnd = new Date(`${period.endDate}T00:00:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(inclusiveEnd.getTime()) || dateKey(start) !== period.startDate || dateKey(inclusiveEnd) !== period.endDate || start > inclusiveEnd || (inclusiveEnd.getTime() - start.getTime()) / DAY_MS > MAX_CUSTOM_DAYS) return null;
    endExclusive = new Date(inclusiveEnd);
    endExclusive.setDate(endExclusive.getDate() + 1);
    label = `${period.startDate} to ${period.endDate}`;
  } else return null;
  return { startDate: dateKey(start), endDateExclusive: dateKey(endExclusive), endDate: dateKey(new Date(endExclusive.getTime() - DAY_MS)), label };
}

function calculateSnapshot(rows: Array<{ amount: number | null; date: string; contribution_categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>, churchId: string, range: NonNullable<ReturnType<typeof resolveReportPeriod>>, generatedAt: string): ContributionSummarySnapshot {
  const categories = new Map<string, number>();
  const monthly = new Map<string, { total: number; count: number }>();
  let total = 0;
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    total += amount;
    const nested = Array.isArray(row.contribution_categories) ? row.contribution_categories[0] : row.contribution_categories;
    const category = nested?.name || "Uncategorized";
    categories.set(category, (categories.get(category) ?? 0) + amount);
    const month = row.date.slice(0, 7);
    const bucket = monthly.get(month) ?? { total: 0, count: 0 };
    bucket.total += amount;
    bucket.count += 1;
    monthly.set(month, bucket);
  }
  return {
    churchId,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: range.label,
    total,
    paymentCount: rows.length,
    comparisonTotal: null,
    percentageChange: null,
    categories: [...categories].map(([name, categoryTotal]) => ({ name, total: categoryTotal })).sort((a, b) => b.total - a.total),
    monthly: [...monthly].map(([month, value]) => ({ month, ...value })).sort((a, b) => a.month.localeCompare(b.month)),
    generatedAt,
  };
}

export async function fetchContributionSummary(context: KanisaAIContext, period: ReportPeriod, options: { recheckReportPermission?: boolean; now?: Date } = {}) {
  const range = resolveReportPeriod(period, options.now);
  if (!range) return { status: "invalid_period" as const, snapshot: null };
  if (!context.church.id || (options.recheckReportPermission && !context.user?.id)) return { status: "forbidden" as const, snapshot: null };
  if (options.recheckReportPermission) {
    const { data: allowed, error: permissionError } = await supabase.rpc("has_church_feature_permission", { _user_id: context.user!.id, _church_id: context.church.id, _feature_key: "contributions", _action: "view" });
    if (permissionError || allowed !== true) return { status: "forbidden" as const, snapshot: null };
  }
  const { data, error } = await supabase.from("contributions").select("amount,date,contribution_categories!contributions_category_id_fkey(name)").eq("church_id", context.church.id).gte("date", range.startDate).lt("date", range.endDateExclusive).order("date");
  if (error) throw error;
  const scopedRows = ((data ?? []) as Array<{ amount: number | null; date: string; contribution_categories?: { name?: string | null } | Array<{ name?: string | null }> | null }>).filter((row) => row.date >= range.startDate && row.date < range.endDateExclusive);
  return { status: "success" as const, snapshot: calculateSnapshot(scopedRows, context.church.id, range, (options.now ?? new Date()).toISOString()) };
}

export async function generateControlledContributionReport(reportType: ControlledReportType, period: ReportPeriod, context: KanisaAIContext): Promise<ContributionReportResult> {
  if (reportType !== "CONTRIBUTION_SUMMARY_REPORT") return { status: "forbidden", message: "That report type is not available." };
  try {
    const result = await fetchContributionSummary(context, period, { recheckReportPermission: true });
    if (result.status === "invalid_period") return { status: "invalid_period", message: "Choose a valid report period of no more than 366 days." };
    if (result.status === "forbidden" || !result.snapshot) return { status: "forbidden", message: "You don't currently have access to contribution reports." };
    if (!result.snapshot.paymentCount) return { status: "no_data", message: "There are no recorded contributions for this period, so there is nothing to include in the report." };
    if (period.kind === "current_month") {
      const comparison = await fetchContributionSummary(context, { kind: "previous_month" });
      if (comparison.status === "success" && comparison.snapshot) {
        result.snapshot.comparisonTotal = comparison.snapshot.total;
        result.snapshot.percentageChange = comparison.snapshot.total > 0 ? ((result.snapshot.total - comparison.snapshot.total) / comparison.snapshot.total) * 100 : null;
      }
    }
    const churchName = context.church.name?.trim() || "Church";
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("KANISA CONNECT", 42, 52);
    doc.setFontSize(13); doc.text(churchName, 42, 78); doc.text("CONTRIBUTION REPORT", 42, 100);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Reporting period: ${result.snapshot.periodLabel}`, 42, 122);
    doc.setFontSize(12); doc.text(`Total contributions: TZS ${result.snapshot.total.toLocaleString("en-US")}`, 42, 160); doc.text(`Recorded payments: ${result.snapshot.paymentCount}`, 42, 182);
    if (result.snapshot.comparisonTotal !== null) doc.text(`Previous month: TZS ${result.snapshot.comparisonTotal.toLocaleString("en-US")}${result.snapshot.percentageChange === null ? "" : ` (${Math.abs(result.snapshot.percentageChange).toFixed(0)}% ${result.snapshot.percentageChange >= 0 ? "higher" : "lower"})`}`, 42, 204);
    let y = 220;
    if (result.snapshot.categories.length) { doc.setFont("helvetica", "bold"); doc.text("Category breakdown", 42, y); y += 20; doc.setFont("helvetica", "normal"); for (const item of result.snapshot.categories.slice(0, 12)) { doc.text(`${item.name}: TZS ${item.total.toLocaleString("en-US")}`, 52, y); y += 17; } }
    if (result.snapshot.monthly.length > 1) { y += 8; doc.setFont("helvetica", "bold"); doc.text("Monthly trend", 42, y); y += 20; doc.setFont("helvetica", "normal"); for (const item of result.snapshot.monthly) { doc.text(`${item.month}: TZS ${item.total.toLocaleString("en-US")} (${item.count} payments)`, 52, y); y += 17; } }
    doc.setFontSize(9); doc.text(`Generated: ${new Date(result.snapshot.generatedAt).toLocaleString("en-TZ")}`, 42, 780); doc.text(`Report period: ${result.snapshot.periodLabel} | Generated through Kanisa Connect`, 42, 796);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const filename = `${churchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "church"}-contribution-report-${result.snapshot.startDate}-${result.snapshot.endDate}.pdf`;
    return { status: "success", message: `Your contribution report for ${result.snapshot.periodLabel} is ready.`, url, filename, snapshot: result.snapshot };
  } catch {
    return { status: "error", message: "I couldn't prepare the report right now. Your contribution data has not been changed." };
  }
}

export function revokeContributionReportUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
