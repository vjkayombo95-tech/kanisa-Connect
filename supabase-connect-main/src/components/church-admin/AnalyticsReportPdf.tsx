import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

type AnalyticsIntentType =
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

type AnalyticsDateRange =
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

type AnalyticsCategory = "all" | "tithe" | "offering" | "building" | "missions" | "youth";

type ContributorSummary = {
  name: string;
  total: number;
  percentage: number;
};

type CategorySummary = {
  category: string;
  total: number;
  percentage: number;
};

type AnalyticsIntent = {
  type: AnalyticsIntentType;
  dateRange: AnalyticsDateRange;
  category: AnalyticsCategory;
};

type AnalyticsSummary = {
  totalGiving: number;
  contributorCount: number;
  averageGift: number;
};

type AnalyticsResponse = {
  query: string;
  intent: AnalyticsIntent;
  dateRange?: AnalyticsDateRange;
  reportTitle?: string;
  confidence?: number;
  detectedFilters?: {
    dateLabel?: string;
    category?: AnalyticsCategory;
    memberName?: string | null;
  };
  summary: AnalyticsSummary;
  shortSummary: string;
  keyMetrics: { label: string; value: string }[];
  insight: string;
  recommendedAction: string;
  forecast?: {
    expectedAmount: number;
    bestCase: number;
    worstCase: number;
    confidence: number;
    direction: string;
    basis: string;
  } | null;
  proactiveDashboard?: {
    healthScore: {
      score: number;
      status: string;
      mainReason: string;
    };
    insights: Array<{
      title: string;
      explanation: string;
      severity: string;
      recommendedAction: string;
    }>;
  } | null;
  topContributors: ContributorSummary[];
  categoryBreakdown: CategorySummary[];
  paymentMethodBreakdown: CategorySummary[];
  insights: string[];
  generatedAt: string;
  dateRangeLabel: string;
  source: "supabase";
  warning?: string | null;
};

export type AnalyticsReportBranding = {
  churchName: string;
  churchLocation?: string | null;
  churchLogoUrl?: string | null;
};

type AnalyticsReportPdfProps = AnalyticsReportBranding & {
  report: AnalyticsResponse;
};

const GOLD = "#D4AF37";
const BG = "#0A0D14";
const PANEL = "#111722";
const PANEL_ALT = "#0E1420";
const TEXT = "#F8F8F4";
const MUTED = "#A9B0BC";
const BORDER = "#263042";
const SUBTLE = "#7D8796";

const styles = StyleSheet.create({
  page: {
    backgroundColor: BG,
    color: TEXT,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  headerShell: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: PANEL_ALT,
    padding: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brandBlock: {
    flex: 1,
  },
  churchName: {
    fontSize: 23,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    lineHeight: 1.2,
  },
  churchLocation: {
    marginTop: 6,
    color: MUTED,
    fontSize: 10,
    lineHeight: 1.4,
  },
  logoFrame: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${GOLD}66`,
    backgroundColor: PANEL,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logo: {
    width: 64,
    height: 64,
    objectFit: "cover",
  },
  titleWrap: {
    marginTop: 18,
    alignItems: "center",
  },
  reportTitle: {
    color: GOLD,
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  divider: {
    height: 2,
    backgroundColor: GOLD,
    borderRadius: 999,
    marginTop: 14,
  },
  metaGrid: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: PANEL,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaLabel: {
    color: SUBTLE,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  metaValue: {
    color: TEXT,
    fontSize: 10,
    lineHeight: 1.35,
  },
  warning: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: `${GOLD}88`,
    borderRadius: 12,
    backgroundColor: "#241B0D",
    color: "#F2E6BE",
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 10,
    lineHeight: 1.45,
  },
  section: {
    marginTop: 20,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  sectionTag: {
    borderWidth: 1,
    borderColor: `${GOLD}88`,
    borderRadius: 999,
    color: GOLD,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
  },
  card: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerText: {
    color: GOLD,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1B2330",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  contributorNumberCol: {
    width: "9%",
  },
  nameCol: {
    width: "45%",
    paddingRight: 8,
  },
  amountCol: {
    width: "26%",
    textAlign: "right",
    paddingRight: 8,
  },
  percentCol: {
    width: "20%",
    textAlign: "right",
  },
  categoryNameCol: {
    width: "54%",
    paddingRight: 8,
  },
  rankText: {
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  valueText: {
    color: TEXT,
    fontSize: 10.5,
    lineHeight: 1.35,
  },
  emptyState: {
    color: MUTED,
    fontSize: 10,
    paddingVertical: 12,
  },
  insightsCard: {
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: `${GOLD}88`,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  insightsIntro: {
    color: MUTED,
    fontSize: 10,
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  insightBullet: {
    width: 16,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  insightText: {
    flex: 1,
    color: TEXT,
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    color: SUBTLE,
    textAlign: "center",
    fontSize: 9,
  },
});

function formatAssistantCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-TZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getDateRangeLabel(dateRange: AnalyticsDateRange) {
  const labels: Record<AnalyticsDateRange, string> = {
    current_month: "Current Month",
    last_month: "Last Month",
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    last_week: "Last Week",
    current_quarter: "Current Quarter",
    last_quarter: "Last Quarter",
    year_to_date: "Year to Date",
    last_year: "Last Year",
    past_90_days: "Past 90 Days",
    all_time: "All Time",
    custom: "Custom Range",
  };

  return labels[dateRange];
}

function getSafeDateRange(report: AnalyticsResponse) {
  return report.dateRange || report.intent?.dateRange || "all_time";
}

function getSafeCategory(report: AnalyticsResponse) {
  return report.intent?.category || "all";
}

function getCategoryLabel(category: AnalyticsCategory) {
  if (category === "all") return "All Categories";
  return category.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFileName(churchName: string, generatedAt: string) {
  const safeChurchName = churchName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStamp = generatedAt.slice(0, 10);
  return `${safeChurchName || "church"}-ai-analytics-report-${dateStamp}.pdf`;
}

export function AnalyticsReportPdf({
  churchName,
  churchLocation,
  churchLogoUrl,
  report,
}: AnalyticsReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerShell}>
          <View style={styles.headerTop}>
            <View style={styles.brandBlock}>
              <Text style={styles.churchName}>{churchName.toUpperCase()}</Text>
              {churchLocation ? <Text style={styles.churchLocation}>{churchLocation}</Text> : null}
            </View>

            {churchLogoUrl ? (
              <View style={styles.logoFrame}>
                <Image src={churchLogoUrl} style={styles.logo} />
              </View>
            ) : null}
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.reportTitle}>{report.reportTitle || "AI Analytics Report"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Date Range</Text>
              <Text style={styles.metaValue}>{report.detectedFilters?.dateLabel || report.dateRangeLabel || getDateRangeLabel(getSafeDateRange(report))}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Generated Date</Text>
              <Text style={styles.metaValue}>{formatDateLabel(report.generatedAt)}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{getCategoryLabel(report.detectedFilters?.category || getSafeCategory(report))}</Text>
            </View>
          </View>

          {report.warning ? <Text style={styles.warning}>{report.warning}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.sectionTag}>Overview</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Giving</Text>
              <Text style={styles.summaryValue}>{formatAssistantCurrency(report.summary?.totalGiving ?? 0)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Contributors</Text>
              <Text style={styles.summaryValue}>{report.summary?.contributorCount ?? 0}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Average Gift</Text>
              <Text style={styles.summaryValue}>{formatAssistantCurrency(report.summary?.averageGift ?? 0)}</Text>
            </View>
          </View>
        </View>

        {report.proactiveDashboard ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Church Health Score</Text>
              <Text style={styles.sectionTag}>{report.proactiveDashboard.healthScore.status}</Text>
            </View>

            <View style={styles.insightsCard}>
              <Text style={styles.insightText}>
                {report.proactiveDashboard.healthScore.score}/100 - {report.proactiveDashboard.healthScore.mainReason}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Detected Filters</Text>
            <Text style={styles.sectionTag}>Query Context</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.valueText}>Date Range: {report.detectedFilters?.dateLabel || report.dateRangeLabel || getDateRangeLabel(getSafeDateRange(report))}</Text>
            <Text style={styles.valueText}>Category: {getCategoryLabel(report.detectedFilters?.category || getSafeCategory(report))}</Text>
            <Text style={styles.valueText}>Member: {report.detectedFilters?.memberName || "All allowed"}</Text>
          </View>
        </View>

        {report.proactiveDashboard?.insights?.length ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>AI Insights Feed</Text>
              <Text style={styles.sectionTag}>Proactive</Text>
            </View>
            <View style={styles.insightsCard}>
              {report.proactiveDashboard.insights.map((insight, index) => (
                <View key={`${insight.title}-${index}`} style={styles.insightRow}>
                  <Text style={styles.insightBullet}>+</Text>
                  <Text style={styles.insightText}>
                    {insight.title}: {insight.explanation} Recommended action: {insight.recommendedAction}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {report.forecast ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Forecast</Text>
              <Text style={styles.sectionTag}>{Math.round(report.forecast.confidence * 100)}% Confidence</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.valueText}>Expected: {formatAssistantCurrency(report.forecast.expectedAmount)}</Text>
              <Text style={styles.valueText}>Best case: {formatAssistantCurrency(report.forecast.bestCase)}</Text>
              <Text style={styles.valueText}>Worst case: {formatAssistantCurrency(report.forecast.worstCase)}</Text>
              <Text style={styles.valueText}>{report.forecast.basis} Trend direction: {report.forecast.direction}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Top Contributors</Text>
            <Text style={styles.sectionTag}>Ranked Giving</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.contributorNumberCol]}>#</Text>
              <Text style={[styles.headerText, styles.nameCol]}>Name</Text>
              <Text style={[styles.headerText, styles.amountCol]}>Amount</Text>
              <Text style={[styles.headerText, styles.percentCol]}>Share</Text>
            </View>

            {(report.topContributors ?? []).length === 0 ? (
              <Text style={styles.emptyState}>No contributor data was available for the selected filter.</Text>
            ) : (
              (report.topContributors ?? []).map((contributor, index) => (
                <View
                  key={`${contributor.name}-${index}`}
                  style={[styles.row, index === report.topContributors.length - 1 ? styles.lastRow : null]}
                >
                  <Text style={[styles.rankText, styles.contributorNumberCol]}>{index + 1}</Text>
                  <Text style={[styles.valueText, styles.nameCol]}>{contributor.name}</Text>
                  <Text style={[styles.valueText, styles.amountCol]}>{formatAssistantCurrency(contributor.total)}</Text>
                  <Text style={[styles.valueText, styles.percentCol]}>{contributor.percentage.toFixed(1)}%</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <Text style={styles.sectionTag}>Distribution</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.categoryNameCol]}>Category</Text>
              <Text style={[styles.headerText, styles.amountCol]}>Amount</Text>
              <Text style={[styles.headerText, styles.percentCol]}>Share</Text>
            </View>

            {(report.categoryBreakdown ?? []).length === 0 ? (
              <Text style={styles.emptyState}>No category data was available for the selected filter.</Text>
            ) : (
              (report.categoryBreakdown ?? []).map((category, index) => (
                <View
                  key={`${category.category}-${index}`}
                  style={[styles.row, index === report.categoryBreakdown.length - 1 ? styles.lastRow : null]}
                >
                  <Text style={[styles.valueText, styles.categoryNameCol]}>{category.category}</Text>
                  <Text style={[styles.valueText, styles.amountCol]}>{formatAssistantCurrency(category.total)}</Text>
                  <Text style={[styles.valueText, styles.percentCol]}>{category.percentage.toFixed(1)}%</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Insights</Text>
            <Text style={styles.sectionTag}>Highlights</Text>
          </View>

          <View style={styles.insightsCard}>
            <Text style={styles.insightsIntro}>Template-based signals surfaced from live Supabase giving data.</Text>
            {[report.shortSummary, report.insight, `Recommended action: ${report.recommendedAction}`]
              .filter(Boolean)
              .map((insight, index) => (
              <View key={`${index}-${insight}`} style={styles.insightRow}>
                <Text style={styles.insightBullet}>+</Text>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>Generated by Kanisa Connect Analytics Assistant from live Supabase records</Text>
      </Page>
    </Document>
  );
}

export async function downloadAnalyticsReportPdf(
  report: AnalyticsResponse,
  branding: AnalyticsReportBranding,
) {
  const resolvedBranding = {
    churchName: branding.churchName || "Church Analytics",
    churchLocation: branding.churchLocation || null,
    churchLogoUrl: branding.churchLogoUrl || null,
  };

  const blob = await pdf(<AnalyticsReportPdf report={report} {...resolvedBranding} />).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getFileName(resolvedBranding.churchName, report.generatedAt);
  anchor.click();
  URL.revokeObjectURL(url);
}

export const generateAnalyticsPdf = downloadAnalyticsReportPdf;
