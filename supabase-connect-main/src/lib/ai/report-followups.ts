import type { ReportPeriod } from "./controlled-answers";

export function normalizeFollowUpText(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function isContributionReportRequest(input: string) {
  return ["yes", "yes generate it", "make a pdf", "generate report", "nataka pdf", "tengeneza report", "nitengenezee pdf"].includes(normalizeFollowUpText(input));
}

export function classifyReportPeriodText(input: string): ReportPeriod | null {
  const text = normalizeFollowUpText(input);
  if (text === "this month" || text === "mwezi huu") return { kind: "current_month" };
  if (text === "last month" || text === "mwezi uliopita") return { kind: "previous_month" };
  if (text === "last 3 months" || text === "miezi 3 iliyopita") return { kind: "last_n_months", months: 3 };
  return null;
}
