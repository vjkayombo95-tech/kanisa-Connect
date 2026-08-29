import { supabase } from "@/integrations/supabase/client";
import { logInfo } from "@/lib/error-logger";

export type AnalyticsReportBranding = {
  churchName: string;
  churchLocation?: string | null;
  churchLogoUrl?: string | null;
};

export type AnalyticsIntentType =
  | "top_contributors"
  | "monthly_report"
  | "category_breakdown"
  | "giving_trend"
  | "inactive_contributors"
  | "active_contributors"
  | "pledge_summary"
  | "outstanding_pledges"
  | "pledge_follow_up"
  | "quarterly_report"
  | "yearly_report"
  | "member_statement"
  | "offerings_vs_tithes"
  | "payment_method_breakdown"
  | "announcement_draft"
  | "contributor_growth"
  | "contribution_forecast"
  | "follow_up_candidates"
  | "first_time_contributors"
  | "recurring_contributors"
  | "church_summary"
  | "general_summary";

export type AnalyticsDateRange =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "current_month"
  | "last_month"
  | "current_quarter"
  | "last_quarter"
  | "year_to_date"
  | "last_year"
  | "past_90_days"
  | "all_time"
  | "custom";
export type AnalyticsCategory = "all" | "tithe" | "offering" | "building" | "missions" | "youth";
export type ChartKind = "monthly_trend" | "category_breakdown" | "top_contributors" | "payment_methods" | "pledge_balances" | "forecast";
export type AnalyticsReportSection =
  | "comparison"
  | "top_contributors"
  | "category_breakdown"
  | "payment_methods"
  | "charts"
  | "inactive_contributors"
  | "pledge_follow_ups"
  | "forecast"
  | "announcement_draft";

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

export type MetricItem = {
  label: string;
  value: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type ChartSummary = {
  kind: ChartKind;
  title: string;
  data: ChartPoint[];
};

export type AnalyticsInsightSeverity = "info" | "success" | "warning" | "danger";

export type AnalyticsInsightAlert = {
  id: string;
  title: string;
  explanation: string;
  severity: AnalyticsInsightSeverity;
  recommendedAction: string;
};

export type ChurchHealthScore = {
  score: number;
  status: "Healthy" | "Watch" | "Needs Attention";
  mainReason: string;
};

export type ContributionForecast = {
  expectedAmount: number;
  bestCase: number;
  worstCase: number;
  confidence: number;
  direction: "up" | "down" | "flat";
  basis: string;
};

export type AnalyticsActionDraft = {
  type: "thank_you" | "inactive_follow_up" | "pledge_reminder" | "announcement";
  title: string;
  body: string;
};

export type AnalyticsDashboardSnapshot = {
  healthScore: ChurchHealthScore;
  insights: AnalyticsInsightAlert[];
  metrics: {
    givingTrend: string;
    activeContributors: number;
    inactiveMembers: number;
    outstandingPledges: number;
    pledgeCompletionRate: number;
    firstTimeContributors: number;
  };
  generatedAt: string;
  privacyMode: "admin" | "member";
};

export type AnalyticsIntent = {
  type: AnalyticsIntentType;
  dateRange: AnalyticsDateRange;
  category: AnalyticsCategory;
};

export type AnalyticsAmountFilter = {
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  amount: number;
};

export type AnalyticsExtractedFilters = {
  dateRange: AnalyticsDateRange;
  dateLabel: string;
  startDate?: string | null;
  endDate?: string | null;
  category: AnalyticsCategory;
  memberName?: string | null;
  amountFilter?: AnalyticsAmountFilter | null;
};

export type AnalyticsSummary = {
  totalGiving: number;
  contributorCount: number;
  averageGift: number;
};

export type AnalyticsComparison = {
  currentTotal: number;
  previousTotal: number;
  changeAmount: number;
  changePercent: number;
  changedMostCategory: string | null;
  changedMostAmount: number;
  lapsedContributors: ContributorSummary[];
};

export type AnalyticsResponse = {
  query: string;
  intent: AnalyticsIntent;
  dateRange: AnalyticsDateRange;
  reportTitle: string;
  reportSections: AnalyticsReportSection[];
  confidence: number;
  detectedFilters: AnalyticsExtractedFilters;
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
  summary: AnalyticsSummary;
  shortSummary: string;
  keyMetrics: MetricItem[];
  insight: string;
  recommendedAction: string;
  topContributors: ContributorSummary[];
  categoryBreakdown: CategorySummary[];
  paymentMethodBreakdown: CategorySummary[];
  inactiveContributors: ContributorSummary[];
  pledgeFollowUps: ContributorSummary[];
  charts: ChartSummary[];
  chartData: ChartSummary[];
  comparison?: AnalyticsComparison;
  announcementDraft?: string | null;
  actionDraft?: AnalyticsActionDraft | null;
  forecast?: ContributionForecast | null;
  followUpPrompts?: string[];
  proactiveDashboard?: AnalyticsDashboardSnapshot | null;
  insights: string[];
  generatedAt: string;
  dateRangeLabel: string;
  source: "supabase";
  privacyMode: "admin" | "member";
  warning?: string | null;
};

type AppRole = "super_admin" | "church_admin" | "pastor" | "secretary" | "treasurer" | "member";

type AnalyticsRow = {
  amount: number;
  created_at: string;
  donor_name: string;
  memberId: string | null;
  memberName: string;
  categoryName: string;
  paymentMethod: string;
};

type PledgeRow = {
  memberName: string;
  balance: number;
};

type PledgeSummary = {
  totalPledged: number;
  totalPaid: number;
  totalBalance: number;
  pledgeCount: number;
  openPledgeCount: number;
  collectionRate: number;
};

export type AnalyticsContext = {
  intent?: AnalyticsIntent;
  filters?: Partial<AnalyticsExtractedFilters>;
};

const AUTHORIZED_ROLES = new Set<AppRole>(["super_admin", "church_admin", "pastor", "secretary", "treasurer"]);
const CONFIDENCE_THRESHOLD = 0.42;
const CLARIFICATION_BYPASS_INTENTS = new Set<AnalyticsIntentType>([
  "contribution_forecast",
  "monthly_report",
  "top_contributors",
  "inactive_contributors",
  "pledge_summary",
  "outstanding_pledges",
  "pledge_follow_up",
  "church_summary",
  "category_breakdown",
  "giving_trend",
  "first_time_contributors",
]);
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const INTENT_SYNONYMS: Record<AnalyticsIntentType, string[]> = {
  top_contributors: ["top contributors", "top givers", "highest donors", "biggest contributors", "who gave the most", "largest contributions", "gave more than", "more than"],
  giving_trend: ["why did giving change", "compare this month", "compare with previous month", "giving performance", "contribution trends", "is giving increasing", "trend", "increase", "drop", "change"],
  monthly_report: ["monthly report", "this month report", "treasurer report", "month summary", "monthly treasurer"],
  yearly_report: ["yearly report", "annual report", "this year", "year to date", "ytd"],
  quarterly_report: ["quarterly report", "this quarter", "last quarter", "quarter"],
  inactive_contributors: ["who stopped contributing", "inactive members", "who has not contributed recently", "at risk members", "inactive contributors", "stopped contributing"],
  active_contributors: ["active contributors", "active members", "who contributed recently", "current contributors"],
  pledge_summary: ["pledge summary", "pledges for", "pledge report", "pledge collection"],
  outstanding_pledges: ["outstanding pledges", "unpaid pledges", "pledge balances", "who still owes a pledge", "pledge follow up", "balance"],
  pledge_follow_up: ["pledge follow up", "pledge reminder", "follow up pledges"],
  member_statement: ["member statement", "member history", "contribution history", "giving history"],
  category_breakdown: ["category breakdown", "category report", "breakdown by category", "categories"],
  offerings_vs_tithes: ["offerings vs tithes", "offering vs tithe", "compare offerings and tithes", "offerings and tithes"],
  payment_method_breakdown: ["payment method", "mpesa", "m-pesa", "cash", "bank", "payment breakdown"],
  announcement_draft: ["announcement", "message", "whatsapp", "send announcement", "follow-up message"],
  contributor_growth: ["contributor growth", "new contributors growth", "growth in contributors"],
  contribution_forecast: ["forecast next month", "predict giving", "next month forecast", "forecast contributions", "what will giving look like next month", "forecast", "predict", "projection", "expected giving"],
  follow_up_candidates: ["follow up candidates", "members needing follow up", "follow-up priorities"],
  first_time_contributors: ["first time contributors", "new givers", "first contribution"],
  recurring_contributors: ["recurring contributors", "regular givers", "consistent contributors"],
  church_summary: ["church summary", "overall summary", "church giving summary", "dashboard"],
  general_summary: ["summary", "show contributions", "contributions"],
};

const HARD_INTENT_PHRASES: Array<{ intent: AnalyticsIntentType; phrases: string[] }> = [
  {
    intent: "contribution_forecast",
    phrases: [
      "forecast next month",
      "predict giving",
      "next month forecast",
      "forecast contributions",
      "what will giving look like next month",
      "expected giving next month",
      "forecast giving",
    ],
  },
  {
    intent: "top_contributors",
    phrases: ["show top contributors", "top contributors", "top givers", "who gave the most"],
  },
  {
    intent: "inactive_contributors",
    phrases: ["show inactive contributors", "inactive members", "who stopped contributing"],
  },
  {
    intent: "giving_trend",
    phrases: ["why did giving change this month", "why did giving change", "compare with previous month", "compare this month to last month"],
  },
  {
    intent: "monthly_report",
    phrases: ["generate monthly treasurer report", "monthly treasurer report", "monthly report"],
  },
  {
    intent: "pledge_summary",
    phrases: ["pledge report", "pledge summary"],
  },
];

function hasAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-TZ", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(start)} to ${formatter.format(addDays(end, -1))}`;
}

function getQuarterStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
}

function extractDateFilter(query: string): AnalyticsExtractedFilters {
  const lower = query.toLowerCase();
  const now = new Date();
  const todayStart = startOfDay(now);
  const currentMonthStart = startOfMonth(now);
  const currentQuarterStart = getQuarterStart(now);
  const currentYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  let range: AnalyticsDateRange = "all_time";
  let start: Date | null = null;
  let end: Date | null = null;
  let label = "All time";

  const pastDays = lower.match(/past\s+(\d+)\s+days?/);
  const monthRange = lower.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\s+(?:to|-)\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december)\b/);

  if (lower.includes("today")) {
    range = "today";
    start = todayStart;
    end = addDays(todayStart, 1);
    label = "Today";
  } else if (lower.includes("yesterday")) {
    range = "yesterday";
    start = addDays(todayStart, -1);
    end = todayStart;
    label = "Yesterday";
  } else if (lower.includes("this week")) {
    range = "this_week";
    start = addDays(todayStart, -todayStart.getUTCDay());
    end = addDays(start, 7);
    label = "This week";
  } else if (lower.includes("last week")) {
    range = "last_week";
    end = addDays(todayStart, -todayStart.getUTCDay());
    start = addDays(end, -7);
    label = "Last week";
  } else if (lower.includes("this month") || lower.includes("current month")) {
    range = "current_month";
    start = currentMonthStart;
    end = shiftMonth(now, 1);
    label = "This month";
  } else if (lower.includes("last month") || lower.includes("previous month")) {
    range = "last_month";
    start = shiftMonth(now, -1);
    end = currentMonthStart;
    label = "Last month";
  } else if (lower.includes("this quarter")) {
    range = "current_quarter";
    start = currentQuarterStart;
    end = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStart.getUTCMonth() + 3, 1));
    label = "This quarter";
  } else if (lower.includes("last quarter")) {
    range = "last_quarter";
    end = currentQuarterStart;
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 3, 1));
    label = "Last quarter";
  } else if (lower.includes("this year") || lower.includes("current year") || lower.includes("year to date") || lower.includes("ytd")) {
    range = "year_to_date";
    start = currentYearStart;
    end = addDays(todayStart, 1);
    label = "This year";
  } else if (lower.includes("last year")) {
    range = "last_year";
    start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    end = currentYearStart;
    label = "Last year";
  } else if (pastDays) {
    const days = Number(pastDays[1] || 90);
    range = "past_90_days";
    start = addDays(todayStart, -days);
    end = addDays(todayStart, 1);
    label = `Past ${days} days`;
  } else if (monthRange) {
    const startMonth = MONTHS.findIndex((month) => month.startsWith(monthRange[1].slice(0, 3)));
    const endMonth = MONTHS.findIndex((month) => month.startsWith(monthRange[2].slice(0, 3)));
    if (startMonth >= 0 && endMonth >= 0) {
      range = "custom";
      start = new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), endMonth + 1, 1));
      label = endLabel(start, end);
    }
  } else {
    const monthIndex = MONTHS.findIndex((month) => lower.includes(month) || lower.includes(month.slice(0, 3)));
    if (monthIndex >= 0) {
      range = "custom";
      start = new Date(Date.UTC(now.getUTCFullYear(), monthIndex, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), monthIndex + 1, 1));
      label = titleCase(MONTHS[monthIndex]);
    } else if (lower.includes("all time") || lower.includes("all-time")) {
      range = "all_time";
      label = "All time";
    }
  }

  return {
    dateRange: range,
    dateLabel: label,
    startDate: start?.toISOString() ?? null,
    endDate: end?.toISOString() ?? null,
    category: "all",
  };
}

function extractCategory(query: string): AnalyticsCategory {
  const lower = query.toLowerCase();
  if (lower.includes("tithe")) return "tithe";
  if (lower.includes("offering") || lower.includes("offerings")) return "offering";
  if (lower.includes("building")) return "building";
  if (lower.includes("mission")) return "missions";
  if (lower.includes("youth")) return "youth";
  return "all";
}

function extractAmountFilter(query: string): AnalyticsAmountFilter | null {
  const lower = query.toLowerCase();
  const match = lower.match(/(?:more than|over|above|greater than|>|less than|under|below|<|at least|>=|up to|<=|equal to|=)\s*(?:tsh|tzs)?\s*([\d,]+)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  if (hasAnyKeyword(lower, ["less than", "under", "below", "<"])) return { operator: "lt", amount };
  if (hasAnyKeyword(lower, ["up to", "<="])) return { operator: "lte", amount };
  if (hasAnyKeyword(lower, ["at least", ">="])) return { operator: "gte", amount };
  if (hasAnyKeyword(lower, ["equal to", "="])) return { operator: "eq", amount };
  return { operator: "gt", amount };
}

function extractMemberName(query: string) {
  const match =
    query.match(/show\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)['’]?\s+(?:contribution|giving|statement|history)/) ||
    query.match(/(?:statement|history)\s+for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match?.[1] ?? null;
}

function scoreIntent(query: string) {
  const lower = query.toLowerCase();
  return (Object.entries(INTENT_SYNONYMS) as Array<[AnalyticsIntentType, string[]]>)
    .map(([intent, phrases]) => {
      const matches = phrases.filter((phrase) => lower.includes(phrase));
      const phraseScore = matches.reduce((sum, phrase) => sum + Math.min(0.28, phrase.length / 70), 0);
      return { intent, score: matches.length > 0 ? 0.25 + phraseScore : 0 };
    })
    .sort((left, right) => right.score - left.score)[0];
}

export function parseAnalyticsIntent(query: string, previousContext?: AnalyticsContext | null) {
  const lower = query.toLowerCase();
  const hardIntent =
    HARD_INTENT_PHRASES.find(({ phrases }) =>
      phrases.some((phrase) => query.toLowerCase().includes(phrase))
    )?.intent ?? null;
  const scored = scoreIntent(query);
  const dateFilter = extractDateFilter(query);
  const category = extractCategory(query);
  const amountFilter = extractAmountFilter(query);
  const memberName = extractMemberName(query);
  const isRefinement = hasAnyKeyword(lower, ["only", "just", "this month", "last month", "this year", "last year", "this quarter", "last quarter"]) && !!previousContext?.intent;
  const type = hardIntent ?? (isRefinement ? previousContext?.intent?.type || scored.intent : scored.intent);
  const inheritedFilters = previousContext?.filters ?? {};
  const resolvedCategory = type === "offerings_vs_tithes" ? "all" : category !== "all" ? category : inheritedFilters.category || "all";
  const filters: AnalyticsExtractedFilters = {
    dateRange: dateFilter.dateRange !== "all_time" ? dateFilter.dateRange : inheritedFilters.dateRange || dateFilter.dateRange,
    dateLabel: dateFilter.dateRange !== "all_time" ? dateFilter.dateLabel : inheritedFilters.dateLabel || dateFilter.dateLabel,
    startDate: dateFilter.dateRange !== "all_time" ? dateFilter.startDate : inheritedFilters.startDate ?? dateFilter.startDate,
    endDate: dateFilter.dateRange !== "all_time" ? dateFilter.endDate : inheritedFilters.endDate ?? dateFilter.endDate,
    category: resolvedCategory,
    memberName: memberName || inheritedFilters.memberName || null,
    amountFilter: amountFilter || inheritedFilters.amountFilter || null,
  };
  const intent: AnalyticsIntent = {
    type,
    dateRange: filters.dateRange,
    category: filters.category,
  };
  const confidence = hardIntent
    ? 0.95
    : Math.min(0.99, scored.score + (dateFilter.dateRange !== "all_time" ? 0.12 : 0) + (category !== "all" ? 0.08 : 0) + (isRefinement ? 0.48 : 0));
  const needsMember = type === "member_statement" && !filters.memberName;
  const vagueContributions = type === "general_summary" && lower.includes("contribution") && dateFilter.dateRange === "all_time";
  const needsClarification =
    (confidence < CONFIDENCE_THRESHOLD && !CLARIFICATION_BYPASS_INTENTS.has(type)) ||
    needsMember ||
    vagueContributions;
  const clarificationQuestion = needsMember
    ? "Which member would you like to view?"
    : vagueContributions
      ? "Would you like this month, this year, or all-time contributions?"
      : confidence < CONFIDENCE_THRESHOLD && !CLARIFICATION_BYPASS_INTENTS.has(type)
        ? "Do you want a monthly report, top contributors, pledge report, or category breakdown?"
        : null;

  return { intent, filters, confidence, needsClarification, clarificationQuestion };
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonth(date: Date, diff: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + diff, 1));
}

function getRangeBounds(dateRange: AnalyticsDateRange) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const currentMonthStart = startOfMonth(now);
  const nextMonthStart = shiftMonth(now, 1);
  const lastMonthStart = shiftMonth(now, -1);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const currentQuarterStart = getQuarterStart(now);

  if (dateRange === "today") return { start: todayStart, end: addDays(todayStart, 1) };
  if (dateRange === "yesterday") return { start: addDays(todayStart, -1), end: todayStart };
  if (dateRange === "this_week") {
    const start = addDays(todayStart, -todayStart.getUTCDay());
    return { start, end: addDays(start, 7) };
  }
  if (dateRange === "last_week") {
    const end = addDays(todayStart, -todayStart.getUTCDay());
    return { start: addDays(end, -7), end };
  }
  if (dateRange === "current_month") return { start: currentMonthStart, end: nextMonthStart };
  if (dateRange === "last_month") return { start: lastMonthStart, end: currentMonthStart };
  if (dateRange === "current_quarter") return { start: currentQuarterStart, end: new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStart.getUTCMonth() + 3, 1)) };
  if (dateRange === "last_quarter") return { start: new Date(Date.UTC(currentQuarterStart.getUTCFullYear(), currentQuarterStart.getUTCMonth() - 3, 1)), end: currentQuarterStart };
  if (dateRange === "year_to_date") return { start: yearStart, end: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
  if (dateRange === "last_year") return { start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)), end: yearStart };
  if (dateRange === "past_90_days") return { start: addDays(todayStart, -90), end: addDays(todayStart, 1) };
  return null;
}

function getMonthComparisonBounds() {
  const now = new Date();
  const currentStart = startOfMonth(now);
  return {
    current: { start: currentStart, end: shiftMonth(now, 1) },
    previous: { start: shiftMonth(now, -1), end: currentStart },
  };
}

function getDateRangeLabel(intent: AnalyticsIntent) {
  const labels: Record<AnalyticsDateRange, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This week",
    last_week: "Last week",
    current_month: "Current month",
    last_month: "Previous month",
    current_quarter: "Current quarter",
    last_quarter: "Previous quarter",
    year_to_date: "Year to date",
    last_year: "Last year",
    past_90_days: "Past 90 days",
    all_time: "All available records",
    custom: "Custom range",
  };

  return `${labels[intent.dateRange]} - ${intent.category === "all" ? "all categories" : intent.category}`;
}

function getEmptySummary(): AnalyticsSummary {
  return {
    totalGiving: 0,
    contributorCount: 0,
    averageGift: 0,
  };
}

function getEmptyComparison(): AnalyticsComparison {
  return {
    currentTotal: 0,
    previousTotal: 0,
    changeAmount: 0,
    changePercent: 0,
    changedMostCategory: null,
    changedMostAmount: 0,
    lapsedContributors: [],
  };
}

function buildSafeAnalyticsResponse(input: {
  query: string;
  intent: AnalyticsIntent;
  filters: AnalyticsExtractedFilters;
  confidence: number;
  privacyMode: "admin" | "member";
  warning?: string | null;
  clarificationQuestion?: string | null;
}): AnalyticsResponse {
  const summary = getEmptySummary();
  const comparison = getEmptyComparison();
  const keyMetrics = [
    { label: "Total giving", value: formatCurrency(0) },
    { label: "Contributors", value: "0" },
    { label: "Average gift", value: formatCurrency(0) },
  ];
  const shortSummary = input.warning || "I couldn't load the analytics data right now. Please try again.";
  const insight = "Live Supabase analytics could not be loaded for this request.";
  const recommendedAction = "Please try again. If the issue continues, refresh the page and confirm your church data permissions.";

  return {
    query: input.query,
    intent: input.intent,
    dateRange: input.intent.dateRange,
    reportTitle: "Analytics unavailable",
    reportSections: [],
    confidence: input.confidence,
    detectedFilters: input.filters,
    needsClarification: !!input.clarificationQuestion,
    clarificationQuestion: input.clarificationQuestion || null,
    summary,
    shortSummary,
    keyMetrics,
    insight,
    recommendedAction,
    topContributors: [],
    categoryBreakdown: [],
    paymentMethodBreakdown: [],
    inactiveContributors: [],
    pledgeFollowUps: [],
    charts: [],
    chartData: [],
    comparison,
    announcementDraft: null,
    actionDraft: null,
    forecast: null,
    followUpPrompts: [],
    insights: [shortSummary, insight, `Recommended action: ${recommendedAction}`],
    generatedAt: new Date().toISOString(),
    dateRangeLabel: input.filters.dateLabel || getDateRangeLabel(input.intent),
    source: "supabase",
    privacyMode: input.privacyMode,
    warning: input.warning || null,
  };
}

function getRelationRecord(value: unknown) {
  if (Array.isArray(value)) return value[0] || null;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function inferPaymentMethod(row: { payment_reference?: string | null; notes?: string | null }) {
  const value = `${row.payment_reference || ""} ${row.notes || ""}`.toLowerCase();
  if (value.includes("mpesa") || value.includes("m-pesa") || value.includes("stk")) return "M-Pesa";
  if (value.includes("bank") || value.includes("transfer")) return "Bank";
  if (value.includes("cash")) return "Cash";
  return row.payment_reference ? "Reference payment" : "Unspecified";
}

function isAuthorizedRole(role?: AppRole | null) {
  return role ? AUTHORIZED_ROLES.has(role) : false;
}

async function getMemberIdForUser(churchId: string, userId?: string | null) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("church_id", churchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function fetchContributionRows(input: {
  churchId: string;
  intent: AnalyticsIntent;
  filters?: AnalyticsExtractedFilters;
  userRole?: AppRole | null;
  userId?: string | null;
  bounds?: { start: Date; end: Date } | null;
}) {
  const memberOnly = !isAuthorizedRole(input.userRole);
  const memberId = memberOnly ? await getMemberIdForUser(input.churchId, input.userId) : null;

  if (memberOnly && !memberId) return [];

  const bounds =
    input.bounds === undefined
      ? input.filters?.startDate && input.filters?.endDate
        ? { start: new Date(input.filters.startDate), end: new Date(input.filters.endDate) }
        : getRangeBounds(input.intent.dateRange)
      : input.bounds;
  let query = supabase
    .from("contributions")
    .select(
      "amount, created_at, donor_name, member_id, payment_reference, notes, members!contributions_member_id_fkey(full_name), contribution_categories!contributions_category_id_fkey(name)",
    )
    .eq("church_id", input.churchId)
    .order("created_at", { ascending: false })
    // Query safety: keep assistant drilldowns bounded. Move broader analysis into analytics_snapshots/RPCs.
    .limit(500);

  if (bounds) {
    query = query.gte("created_at", bounds.start.toISOString()).lt("created_at", bounds.end.toISOString());
  }

  if (memberOnly && memberId) {
    query = query.eq("member_id", memberId);
  }

  if (input.filters?.amountFilter) {
    const { operator, amount } = input.filters.amountFilter;
    if (operator === "gt") query = query.gt("amount", amount);
    if (operator === "gte") query = query.gte("amount", amount);
    if (operator === "lt") query = query.lt("amount", amount);
    if (operator === "lte") query = query.lte("amount", amount);
    if (operator === "eq") query = query.eq("amount", amount);
  }

  const { data, error } = await query;
  if (error) throw error;

  const normalized = (data || []).map((row) => {
    const categoryName = String(getRelationRecord(row.contribution_categories)?.name || "Uncategorized");
    return {
      amount: Number(row.amount || 0),
      created_at: row.created_at || "",
      donor_name: row.donor_name || "",
      memberId: row.member_id || null,
      memberName: String(getRelationRecord(row.members)?.full_name || row.donor_name || "Anonymous"),
      categoryName,
      paymentMethod: inferPaymentMethod(row),
    };
  });

  const category = input.filters?.category || input.intent.category;
  const memberName = input.filters?.memberName?.toLowerCase().trim();
  return normalized
    .filter((row) => (category === "all" ? true : row.categoryName.toLowerCase().includes(category.replace(/_/g, " "))))
    .filter((row) => (memberName ? row.memberName.toLowerCase().includes(memberName) : true));
}

function aggregateRows(rows: AnalyticsRow[]) {
  const totalGiving = rows.reduce((sum, row) => sum + row.amount, 0);
  const contributorTotals = rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.memberName] = (accumulator[row.memberName] || 0) + row.amount;
    return accumulator;
  }, {});
  const categoryTotals = rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.categoryName] = (accumulator[row.categoryName] || 0) + row.amount;
    return accumulator;
  }, {});
  const paymentTotals = rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.paymentMethod] = (accumulator[row.paymentMethod] || 0) + row.amount;
    return accumulator;
  }, {});

  const toSummary = ([name, total]: [string, number]) => ({
    name,
    total,
    percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
  });
  const toCategory = ([category, total]: [string, number]) => ({
    category,
    total,
    percentage: totalGiving > 0 ? (total / totalGiving) * 100 : 0,
  });

  return {
    summary: {
      totalGiving,
      contributorCount: Object.keys(contributorTotals).length,
      averageGift: rows.length > 0 ? totalGiving / rows.length : 0,
    },
    topContributors: Object.entries(contributorTotals).map(toSummary).sort((left, right) => right.total - left.total).slice(0, 5),
    categoryBreakdown: Object.entries(categoryTotals).map(toCategory).sort((left, right) => right.total - left.total),
    paymentMethodBreakdown: Object.entries(paymentTotals).map(toCategory).sort((left, right) => right.total - left.total),
  };
}

function getMonthlyTrend(rows: AnalyticsRow[]) {
  const totals = rows.reduce<Record<string, number>>((accumulator, row) => {
    const date = new Date(row.created_at);
    const label = date.toLocaleDateString("en-TZ", { month: "short", year: "2-digit" });
    accumulator[label] = (accumulator[label] || 0) + row.amount;
    return accumulator;
  }, {});

  return Object.entries(totals).map(([label, value]) => ({ label, value })).slice(-6);
}

function getMonthlyTrendByDate(rows: AnalyticsRow[]) {
  const totals = rows.reduce<Record<string, { label: string; value: number }>>((accumulator, row) => {
    const date = new Date(row.created_at);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-TZ", { month: "short", year: "2-digit" });
    accumulator[key] = accumulator[key] || { label, value: 0 };
    accumulator[key].value += row.amount;
    return accumulator;
  }, {});

  return Object.entries(totals)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => point)
    .slice(-6);
}

function buildForecast(rows: AnalyticsRow[]): ContributionForecast {
  const monthly = getMonthlyTrendByDate(rows).slice(-6);
  const values = monthly.map((point) => point.value);
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const last = values[values.length - 1] || 0;
  const previous = values[values.length - 2] || last;
  const trendDelta = last - previous;
  const expectedAmount = Math.max(0, average + trendDelta * 0.35);
  const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : expectedAmount * 0.2;
  const direction = Math.abs(trendDelta) < Math.max(1, average * 0.05) ? "flat" : trendDelta > 0 ? "up" : "down";

  return {
    expectedAmount,
    bestCase: expectedAmount + spread * 0.35,
    worstCase: Math.max(0, expectedAmount - spread * 0.35),
    confidence: Math.min(0.9, 0.45 + values.length * 0.08),
    direction,
    basis: `Based on ${values.length} recent monthly totals.`,
  };
}

function compareCategories(currentRows: AnalyticsRow[], previousRows: AnalyticsRow[]) {
  const current = aggregateRows(currentRows).categoryBreakdown;
  const previous = aggregateRows(previousRows).categoryBreakdown;
  const previousMap = new Map(previous.map((category) => [category.category, category.total]));
  const names = new Set([...current.map((category) => category.category), ...previous.map((category) => category.category)]);

  return [...names]
    .map((category) => ({
      category,
      change: (current.find((entry) => entry.category === category)?.total || 0) - (previousMap.get(category) || 0),
    }))
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))[0] || null;
}

function getLapsedContributors(currentRows: AnalyticsRow[], previousRows: AnalyticsRow[]) {
  const currentNames = new Set(currentRows.map((row) => row.memberName));
  const previousTotals = aggregateRows(previousRows).topContributors;
  return previousTotals.filter((contributor) => !currentNames.has(contributor.name));
}

function buildComparison(currentRows: AnalyticsRow[], previousRows: AnalyticsRow[]): AnalyticsComparison {
  const currentTotal = currentRows.reduce((sum, row) => sum + row.amount, 0);
  const previousTotal = previousRows.reduce((sum, row) => sum + row.amount, 0);
  const changeAmount = currentTotal - previousTotal;
  const changedMost = compareCategories(currentRows, previousRows);

  return {
    currentTotal,
    previousTotal,
    changeAmount,
    changePercent: previousTotal > 0 ? (changeAmount / previousTotal) * 100 : currentTotal > 0 ? 100 : 0,
    changedMostCategory: changedMost?.category || null,
    changedMostAmount: changedMost?.change || 0,
    lapsedContributors: getLapsedContributors(currentRows, previousRows),
  };
}

async function fetchInactiveContributors(input: { churchId: string; userRole?: AppRole | null; userId?: string | null }) {
  if (!isAuthorizedRole(input.userRole)) return [];

  const { current, previous } = getMonthComparisonBounds();
  const intent: AnalyticsIntent = { type: "inactive_contributors", dateRange: "all_time", category: "all" };
  const currentRows = await fetchContributionRows({ ...input, intent, bounds: current });
  const previousRows = await fetchContributionRows({ ...input, intent, bounds: previous });
  return getLapsedContributors(currentRows, previousRows);
}

async function fetchPledgeReport(input: { churchId: string; userRole?: AppRole | null; userId?: string | null; filters?: AnalyticsExtractedFilters }) {
  const empty = {
    pledgeFollowUps: [] as ContributorSummary[],
    pledgeSummary: {
      totalPledged: 0,
      totalPaid: 0,
      totalBalance: 0,
      pledgeCount: 0,
      openPledgeCount: 0,
      collectionRate: 0,
    },
  };

  if (!isAuthorizedRole(input.userRole)) return empty;

  const pledgeBounds =
    input.filters?.startDate && input.filters?.endDate
      ? { start: new Date(input.filters.startDate), end: new Date(input.filters.endDate) }
      : input.filters
        ? getRangeBounds(input.filters.dateRange)
        : null;
  let query = supabase
    .from("pledges")
    .select("amount_pledged, amount_paid, members!pledges_member_id_fkey(full_name)")
    .eq("church_id", input.churchId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (pledgeBounds) {
    query = query.gte("created_at", pledgeBounds.start.toISOString()).lt("created_at", pledgeBounds.end.toISOString());
  }

  const { data, error } = await query;

  if (error) throw error;

  const pledgeRows = ((data || []) as unknown[])
    .map((row) => {
      const record = row as { amount_pledged?: number; amount_paid?: number; members?: unknown };
      const balance = Number(record.amount_pledged || 0) - Number(record.amount_paid || 0);
      return {
        memberName: String(getRelationRecord(record.members)?.full_name || "Member"),
        pledged: Number(record.amount_pledged || 0),
        paid: Number(record.amount_paid || 0),
        balance,
      };
    });

  const totalPledged = pledgeRows.reduce((sum, row) => sum + row.pledged, 0);
  const totalPaid = pledgeRows.reduce((sum, row) => sum + row.paid, 0);
  const totalBalance = pledgeRows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0);
  const openPledgeCount = pledgeRows.filter((row) => row.balance > 0).length;
  const pledgeFollowUps = pledgeRows
    .filter((row: PledgeRow) => row.balance > 0)
    .sort((left: PledgeRow, right: PledgeRow) => right.balance - left.balance)
    .slice(0, 5)
    .map((row: PledgeRow) => ({ name: row.memberName, total: row.balance, percentage: 0 }));

  return {
    pledgeFollowUps,
    pledgeSummary: {
      totalPledged,
      totalPaid,
      totalBalance,
      pledgeCount: pledgeRows.length,
      openPledgeCount,
      collectionRate: totalPledged > 0 ? (totalPaid / totalPledged) * 100 : 0,
    },
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildAnnouncementDraft(intent: AnalyticsIntent, summary: AnalyticsSummary, comparison?: AnalyticsComparison) {
  const movement = comparison
    ? comparison.changeAmount >= 0
      ? `Giving has increased by ${formatCurrency(Math.abs(comparison.changeAmount))} this month.`
      : `Giving has dropped by ${formatCurrency(Math.abs(comparison.changeAmount))} this month.`
    : "";

  return [
    "Dear church family,",
    `Thank you for your faithful giving. This period we have received ${formatCurrency(summary.totalGiving)} from ${summary.contributorCount} contributors.`,
    movement,
    "Let us continue supporting the work of the church together. For anyone who would like to give or complete a pledge, the finance team is available to assist.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildActionDraft(intent: AnalyticsIntent, input: {
  topContributors: ContributorSummary[];
  inactiveContributors: ContributorSummary[];
  pledgeFollowUps: ContributorSummary[];
  summary: AnalyticsSummary;
  comparison: AnalyticsComparison;
}): AnalyticsActionDraft | null {
  if (intent.type === "top_contributors") {
    const name = input.topContributors[0]?.name || "faithful member";
    return {
      type: "thank_you",
      title: "Thank-you WhatsApp message",
      body: `Hello ${name}, thank you for your faithful support. Your giving is helping the church continue its ministry. May God bless you.`,
    };
  }

  if (["inactive_contributors", "follow_up_candidates", "giving_trend", "monthly_report"].includes(intent.type)) {
    const name = input.inactiveContributors[0]?.name || "dear member";
    return {
      type: "inactive_follow_up",
      title: "Inactive member follow-up message",
      body: `Hello ${name}, we noticed you have not appeared in this month's giving records. We are checking in with care and would be happy to support you if anything has changed.`,
    };
  }

  if (["pledge_summary", "outstanding_pledges", "pledge_follow_up"].includes(intent.type)) {
    const pledge = input.pledgeFollowUps[0];
    return {
      type: "pledge_reminder",
      title: "Pledge reminder message",
      body: `Hello ${pledge?.name || "dear member"}, this is a gentle reminder about your pledge balance${pledge ? ` of ${formatCurrency(pledge.total)}` : ""}. Please contact the finance team if you need assistance.`,
    };
  }

  if (intent.type === "announcement_draft") {
    return {
      type: "announcement",
      title: "General announcement draft",
      body: buildAnnouncementDraft(intent, input.summary, input.comparison),
    };
  }

  return null;
}

function getFollowUpPrompts(intent: AnalyticsIntent): string[] {
  const prompts: Partial<Record<AnalyticsIntentType, string[]>> = {
    top_contributors: ["Compare with last month", "Generate thank-you messages", "Export contributor report"],
    inactive_contributors: ["Generate follow-up message", "Show 90-day inactive members", "Export follow-up list"],
    follow_up_candidates: ["Generate follow-up message", "Show 90-day inactive members", "Export follow-up list"],
    pledge_summary: ["Generate pledge reminder", "Show overdue pledges", "Export pledge balances"],
    outstanding_pledges: ["Generate pledge reminder", "Show overdue pledges", "Export pledge balances"],
    pledge_follow_up: ["Generate pledge reminder", "Show overdue pledges", "Export pledge balances"],
    monthly_report: ["Compare with previous month", "Forecast next month", "Export PDF report"],
    giving_trend: ["Forecast next month", "Show inactive contributors", "Export PDF report"],
    contribution_forecast: ["Show monthly report", "Compare with previous month", "Export PDF report"],
  };

  return prompts[intent.type] || ["Show monthly report", "Show top contributors", "Export PDF report"];
}

function getReportTitle(intent: AnalyticsIntent) {
  const titles: Record<AnalyticsIntentType, string> = {
    top_contributors: "Top Contributor Ranking",
    monthly_report: "Monthly Treasurer Report",
    category_breakdown: "Category Breakdown",
    giving_trend: "Giving Trend Analysis",
    inactive_contributors: "Inactive Contributor Follow-up",
    active_contributors: "Active Contributor Report",
    pledge_summary: "Pledge Summary",
    outstanding_pledges: "Outstanding Pledge Report",
    pledge_follow_up: "Pledge Collection Report",
    quarterly_report: "Quarterly Giving Report",
    yearly_report: "Yearly Giving Report",
    member_statement: "Member Giving Statement",
    offerings_vs_tithes: "Offerings vs Tithes",
    payment_method_breakdown: "Payment Method Breakdown",
    announcement_draft: "Announcement Draft",
    contributor_growth: "Contributor Growth",
    contribution_forecast: "Contribution Forecast",
    follow_up_candidates: "Follow-up Candidates",
    first_time_contributors: "First-time Contributors",
    recurring_contributors: "Recurring Contributors",
    church_summary: "Church Intelligence Summary",
    general_summary: "Giving Summary",
  };

  return titles[intent.type];
}

function getReportSections(intent: AnalyticsIntent): AnalyticsReportSection[] {
  const sections: Record<AnalyticsIntentType, AnalyticsReportSection[]> = {
    top_contributors: ["top_contributors", "charts"],
    monthly_report: ["comparison", "category_breakdown", "charts", "inactive_contributors"],
    category_breakdown: ["category_breakdown", "charts"],
    giving_trend: ["comparison", "charts", "inactive_contributors"],
    inactive_contributors: ["inactive_contributors"],
    active_contributors: ["top_contributors", "charts"],
    pledge_summary: ["pledge_follow_ups", "charts"],
    outstanding_pledges: ["pledge_follow_ups", "charts"],
    pledge_follow_up: ["pledge_follow_ups", "charts"],
    quarterly_report: ["comparison", "category_breakdown", "charts"],
    yearly_report: ["comparison", "category_breakdown", "top_contributors", "charts"],
    member_statement: ["category_breakdown", "charts"],
    offerings_vs_tithes: ["category_breakdown", "charts"],
    payment_method_breakdown: ["payment_methods", "charts"],
    announcement_draft: ["announcement_draft"],
    contributor_growth: ["comparison", "top_contributors", "charts"],
    contribution_forecast: ["comparison", "charts", "forecast"],
    follow_up_candidates: ["inactive_contributors"],
    first_time_contributors: ["top_contributors", "charts"],
    recurring_contributors: ["top_contributors", "charts"],
    church_summary: ["comparison", "category_breakdown", "top_contributors", "charts"],
    general_summary: ["comparison", "category_breakdown", "charts"],
  };

  return sections[intent.type];
}

function buildConversationalResponse(input: {
  intent: AnalyticsIntent;
  rows: AnalyticsRow[];
  summary: AnalyticsSummary;
  topContributors: ContributorSummary[];
  categoryBreakdown: CategorySummary[];
  paymentMethodBreakdown: CategorySummary[];
  inactiveContributors: ContributorSummary[];
  pledgeFollowUps: ContributorSummary[];
  pledgeSummary: PledgeSummary;
  comparison: AnalyticsComparison;
  privacyMode: "admin" | "member";
}) {
  const {
    intent,
    summary,
    topContributors,
    categoryBreakdown,
    paymentMethodBreakdown,
    inactiveContributors,
    pledgeFollowUps,
    pledgeSummary,
    comparison,
    privacyMode,
  } = input;
  const direction = comparison.changeAmount >= 0 ? "increased" : "dropped";
  const topCategory = categoryBreakdown[0]?.category || "uncategorized giving";
  const topPayment = paymentMethodBreakdown[0]?.category || "unspecified payment methods";
  const topContributorTotal = topContributors[0]?.total || 0;
  const concentration = summary.totalGiving > 0 ? (topContributorTotal / summary.totalGiving) * 100 : 0;
  const lapsedTotal = inactiveContributors.reduce((sum, contributor) => sum + contributor.total, 0);

  const shortSummaryByIntent: Partial<Record<AnalyticsIntentType, string>> = {
    top_contributors:
      privacyMode === "admin"
        ? `The top contributor view shows ${topContributors.length} leading contributors and total giving of ${formatCurrency(summary.totalGiving)}.`
        : `Here is your personal giving summary for the selected period.`,
    monthly_report: `This month's giving is ${formatCurrency(comparison.currentTotal)}, ${direction} ${formatCurrency(Math.abs(comparison.changeAmount))} from last month.`,
    category_breakdown: `${topCategory} is the leading category, with total filtered giving of ${formatCurrency(summary.totalGiving)}.`,
    giving_trend: `Giving ${direction} by ${formatCurrency(Math.abs(comparison.changeAmount))}, a ${Math.abs(comparison.changePercent).toFixed(1)}% change from last month.`,
    inactive_contributors: `${inactiveContributors.length} contributors gave last month but have not appeared in this month's records.`,
    pledge_follow_up: `Pledges are ${pledgeSummary.collectionRate.toFixed(1)}% collected, with ${formatCurrency(pledgeSummary.totalBalance)} still outstanding.`,
    pledge_summary: `Pledges are ${pledgeSummary.collectionRate.toFixed(1)}% collected, with ${formatCurrency(pledgeSummary.totalBalance)} still outstanding.`,
    outstanding_pledges: `${pledgeSummary.openPledgeCount} pledges have outstanding balances totaling ${formatCurrency(pledgeSummary.totalBalance)}.`,
    yearly_report: `Year-to-date giving is ${formatCurrency(summary.totalGiving)} from ${summary.contributorCount} contributors.`,
    member_statement: `This member statement view totals ${formatCurrency(summary.totalGiving)} for the selected records.`,
    payment_method_breakdown: `${topPayment} is the leading payment method in the selected giving data.`,
    contribution_forecast: `I calculated a local forecast from recent monthly giving patterns.`,
    announcement_draft: `I prepared a draft announcement from the latest giving summary. It is a preview only and has not been sent.`,
    general_summary: `Total giving is ${formatCurrency(summary.totalGiving)} from ${summary.contributorCount} contributors.`,
  };

  const insightByIntent: Partial<Record<AnalyticsIntentType, string>> = {
    top_contributors:
      concentration > 40
        ? `Giving is concentrated: the leading contributor accounts for ${concentration.toFixed(1)}% of this report's giving.`
        : `Contributor concentration looks moderate, with the leading contributor at ${concentration.toFixed(1)}% of giving.`,
    monthly_report: `Giving ${direction} by ${formatCurrency(Math.abs(comparison.changeAmount))} (${Math.abs(comparison.changePercent).toFixed(1)}%). ${
      comparison.changedMostCategory ? `${comparison.changedMostCategory} changed the most.` : "No single category drove the change."
    }`,
    giving_trend: `The trend moved ${direction} by ${Math.abs(comparison.changePercent).toFixed(1)}%, with ${comparison.lapsedContributors.length} prior contributors missing this month.`,
    inactive_contributors: `The inactive list represents ${formatCurrency(lapsedTotal)} of last month's giving, so follow-up should be prioritized by prior giving level.`,
    pledge_follow_up: `${pledgeSummary.openPledgeCount} of ${pledgeSummary.pledgeCount} pledges still have a balance. Collection rate is ${pledgeSummary.collectionRate.toFixed(1)}%.`,
    pledge_summary: `${pledgeSummary.openPledgeCount} of ${pledgeSummary.pledgeCount} pledges still have a balance. Collection rate is ${pledgeSummary.collectionRate.toFixed(1)}%.`,
    outstanding_pledges: `${pledgeSummary.openPledgeCount} open pledge balances remain, totaling ${formatCurrency(pledgeSummary.totalBalance)}.`,
    category_breakdown: `${topCategory} is the strongest category in this view at ${categoryBreakdown[0]?.percentage.toFixed(1) || "0.0"}% of giving.`,
    payment_method_breakdown: `${topPayment} is the most-used payment method in this report.`,
    announcement_draft: "The draft is based on live giving totals, but it is not sent automatically.",
  };

  const recommendationByIntent: Partial<Record<AnalyticsIntentType, string>> = {
    top_contributors:
      concentration > 40
        ? "Reduce concentration risk by encouraging broader participation while privately thanking major contributors."
        : "Keep recognizing consistent giving and continue widening participation across the congregation.",
    monthly_report: "Share the month-over-month change with leadership and follow up on the category or members driving the variance.",
    giving_trend: "Review the changed category and contact contributors who gave last month but not this month.",
    inactive_contributors: "Start with the highest prior givers and use a gentle pastoral follow-up message before finance reminders.",
    pledge_follow_up: "Prioritize open pledge balances privately, starting with the largest balances and oldest commitments.",
    pledge_summary: "Review collection rate with the finance team and prepare private reminders for open balances.",
    outstanding_pledges: "Prepare private pledge reminders for the largest outstanding balances first.",
    contribution_forecast: "Use this forecast as a planning signal, then revisit it after the next giving cycle.",
    category_breakdown: "Use the leading and weakest categories to guide next Sunday's giving communication.",
    payment_method_breakdown: "Promote the strongest payment channel and clarify instructions for channels with low usage.",
    announcement_draft: "Review the draft, edit the wording for your church tone, then use the Send button only when ready.",
  };

  const insight =
    insightByIntent[intent.type] ||
    (comparison.previousTotal > 0
      ? `Compared with last month, giving ${direction} by ${formatCurrency(Math.abs(comparison.changeAmount))}.`
      : `${topCategory} currently carries the strongest category signal in the available records.`);

  const recommendedAction =
    recommendationByIntent[intent.type] || "Keep monitoring the trend and share a concise treasurer update with church leadership.";

  const keyMetricsByIntent: Partial<Record<AnalyticsIntentType, MetricItem[]>> = {
    top_contributors: [
      { label: "Ranked contributors", value: String(topContributors.length) },
      { label: "Top contributor share", value: `${concentration.toFixed(1)}%` },
      { label: "Ranked giving", value: formatCurrency(topContributors.reduce((sum, entry) => sum + entry.total, 0)) },
    ],
    monthly_report: [
      { label: "This month", value: formatCurrency(comparison.currentTotal) },
      { label: "Previous month", value: formatCurrency(comparison.previousTotal) },
      { label: "Change", value: `${comparison.changePercent >= 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}%` },
    ],
    giving_trend: [
      { label: "Change amount", value: `${comparison.changeAmount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(comparison.changeAmount))}` },
      { label: "Change rate", value: `${comparison.changePercent >= 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}%` },
      { label: "Lapsed contributors", value: String(comparison.lapsedContributors.length) },
    ],
    inactive_contributors: [
      { label: "Inactive contributors", value: String(inactiveContributors.length) },
      { label: "Prior giving at risk", value: formatCurrency(lapsedTotal) },
      { label: "Follow-up priority", value: inactiveContributors[0]?.name || "None" },
    ],
    pledge_follow_up: [
      { label: "Pledged", value: formatCurrency(pledgeSummary.totalPledged) },
      { label: "Collected", value: `${pledgeSummary.collectionRate.toFixed(1)}%` },
      { label: "Outstanding", value: formatCurrency(pledgeSummary.totalBalance) },
    ],
    pledge_summary: [
      { label: "Pledged", value: formatCurrency(pledgeSummary.totalPledged) },
      { label: "Collected", value: `${pledgeSummary.collectionRate.toFixed(1)}%` },
      { label: "Outstanding", value: formatCurrency(pledgeSummary.totalBalance) },
    ],
    outstanding_pledges: [
      { label: "Open pledges", value: String(pledgeSummary.openPledgeCount) },
      { label: "Outstanding", value: formatCurrency(pledgeSummary.totalBalance) },
      { label: "Collected", value: `${pledgeSummary.collectionRate.toFixed(1)}%` },
    ],
    category_breakdown: [
      { label: "Total giving", value: formatCurrency(summary.totalGiving) },
      { label: "Categories", value: String(categoryBreakdown.length) },
      { label: "Leading category", value: topCategory },
    ],
    payment_method_breakdown: [
      { label: "Total giving", value: formatCurrency(summary.totalGiving) },
      { label: "Methods", value: String(paymentMethodBreakdown.length) },
      { label: "Leading method", value: topPayment },
    ],
  };

  return {
    shortSummary: shortSummaryByIntent[intent.type] || shortSummaryByIntent.general_summary || "",
    insight,
    recommendedAction,
    keyMetrics: keyMetricsByIntent[intent.type] || [
      { label: "Total giving", value: formatCurrency(summary.totalGiving) },
      { label: "Contributors", value: String(summary.contributorCount) },
      { label: "Average gift", value: formatCurrency(summary.averageGift) },
      { label: "Monthly change", value: `${comparison.changeAmount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(comparison.changeAmount))}` },
      { label: "Percent change", value: `${comparison.changePercent >= 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}%` },
    ],
  };
}

function buildIntentCharts(input: {
  intent: AnalyticsIntent;
  allRows: AnalyticsRow[];
  topContributors: ContributorSummary[];
  categoryBreakdown: CategorySummary[];
  paymentMethodBreakdown: CategorySummary[];
  pledgeFollowUps: ContributorSummary[];
  forecast?: ContributionForecast | null;
  privacyMode: "admin" | "member";
}) {
  const charts: ChartSummary[] = [];
  const { intent, allRows, topContributors, categoryBreakdown, paymentMethodBreakdown, pledgeFollowUps, forecast, privacyMode } = input;

  if (["monthly_report", "giving_trend", "yearly_report", "general_summary", "member_statement"].includes(intent.type)) {
    charts.push({ kind: "monthly_trend", title: "Monthly giving trend", data: getMonthlyTrend(allRows) });
  }

  if (["top_contributors"].includes(intent.type)) {
    charts.push({
      kind: "top_contributors",
      title: privacyMode === "admin" ? "Contributor ranking" : "Your giving",
      data: topContributors.map((entry) => ({ label: entry.name, value: entry.total })),
    });
  }

  if (["category_breakdown", "monthly_report", "yearly_report", "general_summary"].includes(intent.type)) {
    charts.push({ kind: "category_breakdown", title: "Category breakdown", data: categoryBreakdown.map((entry) => ({ label: entry.category, value: entry.total })) });
  }

  if (intent.type === "payment_method_breakdown") {
    charts.push({ kind: "payment_methods", title: "Payment methods", data: paymentMethodBreakdown.map((entry) => ({ label: entry.category, value: entry.total })) });
  }

  if (intent.type === "pledge_follow_up") {
    charts.push({ kind: "pledge_balances", title: "Largest pledge balances", data: pledgeFollowUps.map((entry) => ({ label: entry.name, value: entry.total })) });
  }

  if (intent.type === "contribution_forecast" && forecast) {
    charts.push({
      kind: "forecast",
      title: "Next month forecast",
      data: [
        { label: "Worst case", value: forecast.worstCase },
        { label: "Expected", value: forecast.expectedAmount },
        { label: "Best case", value: forecast.bestCase },
      ],
    });
  }

  return charts.filter((chart) => chart.data.length > 0);
}

function getHealthStatus(score: number): ChurchHealthScore["status"] {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Watch";
  return "Needs Attention";
}

function createInsight(id: string, title: string, explanation: string, severity: AnalyticsInsightSeverity, recommendedAction: string): AnalyticsInsightAlert {
  return { id, title, explanation, severity, recommendedAction };
}

export async function fetchAnalyticsDashboard(input: {
  churchId: string;
  userRole?: AppRole | null;
  userId?: string | null;
}): Promise<AnalyticsDashboardSnapshot> {
  const privacyMode = isAuthorizedRole(input.userRole) ? "admin" : "member";
  const baseIntent: AnalyticsIntent = { type: "church_summary", dateRange: "all_time", category: "all" };
  const { current, previous } = getMonthComparisonBounds();
  const recentBounds = { start: addDays(startOfDay(new Date()), -210), end: addDays(startOfDay(new Date()), 1) };
  const [currentRows, previousRows, recentRows, pledgeReport] = await Promise.all([
    fetchContributionRows({ ...input, intent: baseIntent, bounds: current }),
    fetchContributionRows({ ...input, intent: baseIntent, bounds: previous }),
    fetchContributionRows({ ...input, intent: baseIntent, bounds: recentBounds }),
    fetchPledgeReport(input),
  ]);
  const comparison = buildComparison(currentRows, previousRows);
  const currentAggregate = aggregateRows(currentRows);
  const previousAggregate = aggregateRows(previousRows);
  const inactiveContributors = privacyMode === "admin" ? getLapsedContributors(currentRows, previousRows) : [];
  const recentMemberNames = new Set(recentRows.map((row) => row.memberName));
  const previousMemberNames = new Set(previousRows.map((row) => row.memberName));
  const firstTimeContributors = currentRows.filter((row) => !previousMemberNames.has(row.memberName)).length;
  const topThreeTotal = currentAggregate.topContributors.slice(0, 3).reduce((sum, row) => sum + row.total, 0);
  const concentration = currentAggregate.summary.totalGiving > 0 ? (topThreeTotal / currentAggregate.summary.totalGiving) * 100 : 0;
  const trendScore = Math.max(0, Math.min(25, 14 + comparison.changePercent / 4));
  const activeScore = Math.min(20, currentAggregate.summary.contributorCount * 2);
  const inactivePenalty = Math.min(20, inactiveContributors.length * 3);
  const pledgeScore = Math.min(25, pledgeReport.pledgeSummary.collectionRate / 4);
  const concentrationPenalty = concentration > 65 ? 18 : concentration > 50 ? 10 : 0;
  const score = Math.round(Math.max(0, Math.min(100, 35 + trendScore + activeScore + pledgeScore - inactivePenalty - concentrationPenalty)));
  const mainReason =
    concentrationPenalty > 0
      ? `Top contributors account for ${concentration.toFixed(1)}% of giving.`
      : inactiveContributors.length > 0
        ? `${inactiveContributors.length} members who gave last month have not given this month.`
        : comparison.changeAmount < 0
          ? `Giving dropped by ${Math.abs(comparison.changePercent).toFixed(1)}% compared to last month.`
          : "Giving and pledge completion are stable.";
  const insights: AnalyticsInsightAlert[] = [
    createInsight(
      "giving-trend",
      comparison.changeAmount >= 0 ? `Giving increased ${comparison.changePercent.toFixed(1)}% this month` : `Giving dropped ${Math.abs(comparison.changePercent).toFixed(1)}% this month`,
      `${formatCurrency(comparison.currentTotal)} this month vs ${formatCurrency(comparison.previousTotal)} last month.`,
      comparison.changeAmount >= 0 ? "success" : "warning",
      comparison.changeAmount >= 0 ? "Thank contributors and keep the momentum visible." : "Review changed categories and follow up with inactive contributors.",
    ),
  ];

  if (inactiveContributors.length > 0) {
    insights.push(createInsight("inactive", `${inactiveContributors.length} members became inactive`, `${inactiveContributors.length} members who gave last month have not contributed this month.`, "warning", "Prioritize a pastoral follow-up list."));
  }

  if (pledgeReport.pledgeSummary.totalBalance > 0) {
    insights.push(createInsight("pledges", `${formatCurrency(pledgeReport.pledgeSummary.totalBalance)} in outstanding pledges`, `${pledgeReport.pledgeSummary.openPledgeCount} pledge records still have a balance.`, "danger", "Prepare private pledge reminders."));
  }

  if (firstTimeContributors > 0) {
    insights.push(createInsight("first-time", `${firstTimeContributors} first-time contributors`, "New contributors appeared in this month's records.", "success", "Send thank-you messages and welcome them into regular participation."));
  }

  if (currentAggregate.categoryBreakdown[0] && previousAggregate.categoryBreakdown[0]) {
    insights.push(createInsight("category", `${currentAggregate.categoryBreakdown[0].category} leads this month`, `${currentAggregate.categoryBreakdown[0].category} is ${currentAggregate.categoryBreakdown[0].percentage.toFixed(1)}% of current giving.`, "info", "Use category movement to guide giving communication."));
  }

  if (concentration > 50) {
    insights.push(createInsight("concentration", "Contributor concentration risk", `Top 3 contributors make up ${concentration.toFixed(1)}% of this month's giving.`, "danger", "Encourage broader participation while privately appreciating major contributors."));
  }

  return {
    healthScore: { score, status: getHealthStatus(score), mainReason },
    insights: insights.slice(0, 6),
    metrics: {
      givingTrend: `${comparison.changePercent >= 0 ? "+" : ""}${comparison.changePercent.toFixed(1)}%`,
      activeContributors: recentMemberNames.size,
      inactiveMembers: inactiveContributors.length,
      outstandingPledges: pledgeReport.pledgeSummary.totalBalance,
      pledgeCompletionRate: pledgeReport.pledgeSummary.collectionRate,
      firstTimeContributors,
    },
    generatedAt: new Date().toISOString(),
    privacyMode,
  };
}

export async function fetchAnalyticsAssistant(input: {
  query: string;
  churchId: string;
  accessToken: string;
  userRole?: AppRole | null;
  userId?: string | null;
  previousContext?: AnalyticsContext | null;
}): Promise<AnalyticsResponse> {
  const parsed = parseAnalyticsIntent(input.query, input.previousContext);
  const { intent, filters, confidence, needsClarification, clarificationQuestion } = parsed;
  logInfo("Analytics intent parsed.", {
    function: "fetchAnalyticsAssistant",
    church_id: input.churchId,
    user_id: input.userId,
    metadata: { intent: intent.type, confidence },
  });
  const privacyMode = isAuthorizedRole(input.userRole) ? "admin" : "member";
  if (needsClarification) {
    logInfo("Analytics forecast skipped while awaiting clarification.", {
      function: "fetchAnalyticsAssistant",
      church_id: input.churchId,
      user_id: input.userId,
      metadata: { intent: intent.type },
    });
    return buildSafeAnalyticsResponse({
      query: input.query,
      intent,
      filters,
      confidence,
      privacyMode,
      warning: clarificationQuestion || "I need one more detail before I can build this report.",
      clarificationQuestion,
    });
  }

  try {
    const rows = await fetchContributionRows({ ...input, intent, filters });
    const allRows = await fetchContributionRows({ ...input, intent: { ...intent, dateRange: "all_time", category: "all" }, filters: { ...filters, dateRange: "all_time", dateLabel: "All time", startDate: null, endDate: null, category: "all" }, bounds: null });
    const { current, previous } = getMonthComparisonBounds();
    const currentRows = await fetchContributionRows({ ...input, intent: { ...intent, dateRange: "all_time" }, filters, bounds: current });
    const previousRows = await fetchContributionRows({ ...input, intent: { ...intent, dateRange: "all_time" }, filters, bounds: previous });
    const comparison = buildComparison(currentRows, previousRows);
    const inactiveContributors = await fetchInactiveContributors(input);
    const { pledgeFollowUps, pledgeSummary } = await fetchPledgeReport({ ...input, filters });
    const { summary, topContributors, categoryBreakdown, paymentMethodBreakdown } = aggregateRows(rows);
    const responseText = buildConversationalResponse({
      intent,
      rows,
      summary,
      topContributors,
      categoryBreakdown,
      paymentMethodBreakdown,
      inactiveContributors,
      pledgeFollowUps,
      pledgeSummary,
      comparison,
      privacyMode,
    });
    const announcementDraft = intent.type === "announcement_draft" ? buildAnnouncementDraft(intent, summary, comparison) : null;
    const forecast = intent.type === "contribution_forecast" ? buildForecast(allRows) : null;
    logInfo("Analytics forecast evaluated.", {
      function: "fetchAnalyticsAssistant",
      church_id: input.churchId,
      user_id: input.userId,
      metadata: { generated: Boolean(forecast) },
    });
    const actionDraft = buildActionDraft(intent, {
      topContributors,
      inactiveContributors,
      pledgeFollowUps,
      summary,
      comparison,
    });
    const charts = buildIntentCharts({
      intent,
      allRows,
      topContributors,
      categoryBreakdown,
      paymentMethodBreakdown,
      pledgeFollowUps,
      forecast,
      privacyMode,
    });

    return {
      query: input.query,
      intent,
      dateRange: intent.dateRange,
      reportTitle: getReportTitle(intent),
      reportSections: getReportSections(intent),
      confidence,
      detectedFilters: filters,
      needsClarification: false,
      clarificationQuestion: null,
      summary,
      ...responseText,
      topContributors,
      categoryBreakdown,
      paymentMethodBreakdown,
      inactiveContributors,
      pledgeFollowUps,
      charts,
      chartData: charts,
      comparison,
      announcementDraft,
      actionDraft,
      forecast,
      followUpPrompts: getFollowUpPrompts(intent),
      insights: [responseText.shortSummary, responseText.insight, `Recommended action: ${responseText.recommendedAction}`],
      generatedAt: new Date().toISOString(),
      dateRangeLabel: filters.dateLabel || getDateRangeLabel(intent),
      source: "supabase",
      privacyMode,
      warning: privacyMode === "member" ? "Member privacy mode is active, so only your own giving records are shown." : null,
    };
  } catch (error) {
    console.error("Analytics assistant Supabase query failed:", error);
    return buildSafeAnalyticsResponse({
      query: input.query,
      intent,
      filters,
      confidence,
      privacyMode,
      warning: "I couldn't load the analytics data right now. Please try again.",
    });
  }
}

export function formatAssistantCurrency(amount: number) {
  return formatCurrency(amount);
}

export async function exportAnalyticsPdf(report: AnalyticsResponse, branding: AnalyticsReportBranding) {
  const { generateAnalyticsPdf } = await import("@/components/church-admin/AnalyticsReportPdf");
  return generateAnalyticsPdf(report, branding);
}
