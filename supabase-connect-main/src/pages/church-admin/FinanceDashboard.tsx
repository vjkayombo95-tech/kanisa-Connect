import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, HeartHandshake, Wallet } from "lucide-react";

import {
  AuditSummaryWidget,
  ContributionTrendWidget,
  FinanceMetricWidget,
  FinanceQuickActionsWidget,
  FinanceReportsWidget,
  ParishFinanceSummaryWidget,
  PlatformFeeSummaryWidget,
  RecentCollectionsWidget,
  TodaysScheduleWidget,
  type DashboardWidget,
} from "@/components/portal/dashboard";
import { useWorkspaceContext, WorkspaceResolver } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getLatestAnalyticsSnapshot, type AnalyticsSnapshotRow } from "@/lib/analytics-snapshots";
import { EMPTY_CHURCH_FINANCIAL_SUMMARY, useChurchFinancialSummary, type ChurchFinancialSummary } from "@/lib/church-financial-summary";
import { formatTZS } from "@/lib/currency";

type ContributionRow = {
  id: string;
  amount: number | string | null;
  donor_name: string | null;
  payment_reference: string | null;
  created_at: string;
  date?: string | null;
  contribution_categories?: { name?: string | null } | null;
  members?: { full_name?: string | null } | null;
};

type DashboardMetrics = {
  this_month_giving?: number | string;
  last_month_giving?: number | string;
  monthly_giving?: Array<{ key?: string; month?: string; amount?: number | string }>;
};

type SnapshotPayload = {
  thisTotal?: number;
  transactionCount?: number;
  categoryCount?: number;
  topCategories?: Array<{ name: string; total: number }>;
  categoryComparison?: Array<{ name: string; thisMonth: number; lastMonth: number; change: number }>;
};

type FinanceDashboardSummary = {
  todayContributions: number;
  thisMonthContributions: number;
  thisYearContributions: number;
  lifetimeContributions: number;
  contributionCount: number;
  monthlyGiving: Array<{ label: string; value: number }>;
  communityHelp: {
    pending: number;
    approved: number;
  };
};

type PlatformFeeRow = {
  fee_amount?: number | string | null;
  net_amount?: number | string | null;
};

type PledgeSummaryRow = {
  balance?: number | string | null;
};

type AuditRow = {
  id: string;
  created_at: string;
};

type FinanceDashboardContext = {
  audit: AuditRow[];
  auditError: boolean;
  auditLoading: boolean;
  outstandingPledges: number;
  platformFees: PlatformFeeRow[];
  platformFeesError: boolean;
  platformFeesLoading: boolean;
  pledgesError: boolean;
  pledgesLoading: boolean;
  recentContributions: ContributionRow[];
  recentContributionsError: boolean;
  recentContributionsLoading: boolean;
  reportSnapshot: AnalyticsSnapshotRow<SnapshotPayload> | null | undefined;
  reportSnapshotError: boolean;
  reportSnapshotLoading: boolean;
  summary: FinanceDashboardSummary;
  summaryError: boolean;
  summaryLoading: boolean;
  financialSummary: ChurchFinancialSummary;
  financialSummaryError: boolean;
  financialSummaryLoading: boolean;
};

const emptySummary: FinanceDashboardSummary = {
  todayContributions: 0,
  thisMonthContributions: 0,
  thisYearContributions: 0,
  lifetimeContributions: 0,
  contributionCount: 0,
  monthlyGiving: [],
  communityHelp: {
    pending: 0,
    approved: 0,
  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yearStartKey() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function readContributionTotal(rows: unknown) {
  const firstRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : null;
  return Number(firstRow?.total ?? 0);
}

function pledgeBalance(rows: unknown) {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((sum, row) => sum + Number((row as PledgeSummaryRow).balance ?? 0), 0);
}

function contributionTitle(contribution: ContributionRow) {
  return contribution.members?.full_name || contribution.donor_name || "Anonymous";
}

function contributionPurpose(contribution: ContributionRow) {
  return contribution.contribution_categories?.name || "General Contribution";
}

export default function FinanceDashboard() {
  const { churchId } = useAuth();
  const today = todayKey();
  const yearStart = yearStartKey();

  const {
    data: summary = emptySummary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ["church-dashboard-deferred", churchId],
    queryFn: async (): Promise<FinanceDashboardSummary> => {
      if (!churchId) return emptySummary;

      const [
        metrics,
        todayContributions,
        yearContributions,
        lifetimeContributions,
        contributionCount,
        pendingCommunityHelp,
        approvedCommunityHelp,
      ] = await Promise.all([
        supabase.rpc("get_church_dashboard_metrics" as never, { p_church_id: churchId } as never),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId).eq("date", today),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId).gte("date", yearStart),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId),
        supabase.from("contributions").select("id", { count: "exact", head: true }).eq("church_id", churchId),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "approved"),
      ]);

      const dashboardMetrics = (metrics.data ?? {}) as DashboardMetrics;

      return {
        todayContributions: readContributionTotal(todayContributions.data),
        thisMonthContributions: Number(dashboardMetrics.this_month_giving ?? 0),
        thisYearContributions: readContributionTotal(yearContributions.data),
        lifetimeContributions: readContributionTotal(lifetimeContributions.data),
        contributionCount: contributionCount.count ?? 0,
        monthlyGiving: (dashboardMetrics.monthly_giving ?? []).map((row) => ({
          label: row.month || row.key || "Month",
          value: Number(row.amount ?? 0),
        })),
        communityHelp: {
          pending: pendingCommunityHelp.count ?? 0,
          approved: approvedCommunityHelp.count ?? 0,
        },
      };
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: financialSummary = EMPTY_CHURCH_FINANCIAL_SUMMARY,
    isLoading: financialSummaryLoading,
    isError: financialSummaryError,
  } = useChurchFinancialSummary();

  const {
    data: recentContributions = [],
    isLoading: recentContributionsLoading,
    isError: recentContributionsError,
  } = useQuery({
    queryKey: ["contributions", churchId, "finance-dashboard-recent"],
    queryFn: async (): Promise<ContributionRow[]> => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, donor_name, payment_reference, created_at, date, contribution_categories!contributions_category_id_fkey(name), members!contributions_member_id_fkey(full_name)")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data ?? []) as ContributionRow[];
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: pledgeSummary = [],
    isLoading: pledgesLoading,
    isError: pledgesError,
  } = useQuery({
    queryKey: ["church-pledges-summary", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase.rpc("get_church_pledges_summary" as never, { _church_id: churchId } as never);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: reportSnapshot,
    isLoading: reportSnapshotLoading,
    isError: reportSnapshotError,
  } = useQuery({
    queryKey: ["reports-analytics-snapshot", churchId],
    queryFn: () => (churchId ? getLatestAnalyticsSnapshot<SnapshotPayload>(churchId) : Promise.resolve(null)),
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: platformFees = [],
    isLoading: platformFeesLoading,
    isError: platformFeesError,
  } = useQuery({
    queryKey: ["finance-platform-fees", churchId],
    queryFn: async (): Promise<PlatformFeeRow[]> => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("platform_fees")
        .select("fee_amount, net_amount")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as PlatformFeeRow[];
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: audit = [],
    isLoading: auditLoading,
    isError: auditError,
  } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("contribution_audit_logs")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const context: FinanceDashboardContext = {
    audit,
    auditError,
    auditLoading,
    outstandingPledges: pledgeBalance(pledgeSummary),
    platformFees,
    platformFeesError,
    platformFeesLoading,
    pledgesError,
    pledgesLoading,
    recentContributions,
    recentContributionsError,
    recentContributionsLoading,
    reportSnapshot,
    reportSnapshotError,
    reportSnapshotLoading,
    summary,
    summaryError,
    summaryLoading,
    financialSummary,
    financialSummaryError,
    financialSummaryLoading,
  };

  const widgets: Record<string, DashboardWidget<FinanceDashboardContext>> = {
    "todays-contributions": {
      id: "todays-contributions",
      render: ({ summary, summaryError, summaryLoading }) => (
        <FinanceMetricWidget
          title="Today's Contributions"
          value={formatTZS(summary.todayContributions)}
          description="Recorded giving for today."
          icon={CircleDollarSign}
          to="/finance/contributions"
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "todays-schedule": {
      id: "todays-schedule",
      render: () => <TodaysScheduleWidget churchId={churchId} workspace="finance" calendarPath="/finance/calendar" />,
    },
    "this-month-contributions": {
      id: "this-month-contributions",
      render: ({ financialSummary, financialSummaryError, financialSummaryLoading }) => (
        <ParishFinanceSummaryWidget
          thisMonthReceived={financialSummary.thisMonthReceived}
          totalReceived={financialSummary.totalReceived}
          transactionCount={financialSummary.transactionCount}
          contributionTotal={financialSummary.contributionTotal}
          pledgePaymentTotal={financialSummary.pledgePaymentTotal}
          eventRegistrationTotal={financialSummary.eventRegistrationTotal}
          isLoading={financialSummaryLoading}
          isError={financialSummaryError}
        />
      ),
    },
    "this-year-contributions": {
      id: "this-year-contributions",
      render: ({ summary, summaryError, summaryLoading }) => (
        <FinanceMetricWidget
          title="This Year"
          value={formatTZS(summary.thisYearContributions)}
          description="Contributions recorded since January 1."
          icon={CalendarDays}
          to="/finance/reports"
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "outstanding-pledges": {
      id: "outstanding-pledges",
      render: ({ outstandingPledges, pledgesError, pledgesLoading }) => (
        <FinanceMetricWidget
          title="Outstanding Pledges"
          value={formatTZS(outstandingPledges)}
          description="Unpaid pledge balance from pledge summaries."
          icon={Wallet}
          to="/finance/pledges"
          isLoading={pledgesLoading}
          isError={pledgesError}
        />
      ),
    },
    "community-help-summary": {
      id: "community-help-summary",
      render: ({ summary, summaryError, summaryLoading }) => (
        <FinanceMetricWidget
          title="Community Help Summary"
          value={String(summary.communityHelp.pending)}
          description={`${summary.communityHelp.approved} approved assistance requests.`}
          icon={HeartHandshake}
          to="/finance/community-help"
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "recent-contributions": {
      id: "recent-contributions",
      render: ({ recentContributions, recentContributionsError, recentContributionsLoading }) => (
        <RecentCollectionsWidget
          title="Recent Contributions"
          description="Newest contribution records."
          items={recentContributions.map((contribution) => ({
            id: contribution.id,
            title: contributionTitle(contribution),
            detail: contributionPurpose(contribution),
            amount: formatTZS(Number(contribution.amount ?? 0)),
            date: contribution.date || contribution.created_at,
          }))}
          emptyMessage="No recent contributions recorded."
          to="/finance/contributions"
          isLoading={recentContributionsLoading}
          isError={recentContributionsError}
        />
      ),
    },
    "pending-payments": {
      id: "pending-payments",
      render: ({ recentContributions, recentContributionsError, recentContributionsLoading }) => {
        const pending = recentContributions.filter((contribution) => !contribution.payment_reference);

        return (
          <RecentCollectionsWidget
            title="Pending Payments"
            description="Recent contributions without payment references."
            items={pending.map((contribution) => ({
              id: contribution.id,
              title: contributionTitle(contribution),
              detail: contributionPurpose(contribution),
              amount: formatTZS(Number(contribution.amount ?? 0)),
              date: contribution.date || contribution.created_at,
            }))}
            emptyMessage="No pending payment references found."
            to="/finance/contributions"
            isLoading={recentContributionsLoading}
            isError={recentContributionsError}
          />
        );
      },
    },
    "recent-receipts": {
      id: "recent-receipts",
      render: ({ recentContributions, recentContributionsError, recentContributionsLoading }) => (
        <RecentCollectionsWidget
          title="Recent Receipts"
          description="Receipt-ready contribution records."
          items={recentContributions
            .filter((contribution) => !!contribution.payment_reference)
            .map((contribution) => ({
              id: contribution.id,
              title: contribution.payment_reference || "Receipt",
              detail: contributionTitle(contribution),
              amount: formatTZS(Number(contribution.amount ?? 0)),
              date: contribution.date || contribution.created_at,
            }))}
          emptyMessage="No recent receipt references found."
          to="/finance/receipts"
          isLoading={recentContributionsLoading}
          isError={recentContributionsError}
        />
      ),
    },
    "quick-reconciliation-summary": {
      id: "quick-reconciliation-summary",
      render: ({ recentContributions, recentContributionsError, recentContributionsLoading }) => {
        const withReferences = recentContributions.filter((contribution) => !!contribution.payment_reference).length;
        const missingReferences = recentContributions.length - withReferences;

        return (
          <FinanceReportsWidget
            title="Quick Reconciliation Summary"
            description="Reference coverage for recent contribution records."
            rows={[
              { label: "With references", value: String(withReferences) },
              { label: "Missing references", value: String(missingReferences) },
              { label: "Recent rows checked", value: String(recentContributions.length) },
            ]}
            to="/finance/contributions"
            isLoading={recentContributionsLoading}
            isError={recentContributionsError}
          />
        );
      },
    },
    "quick-actions": {
      id: "quick-actions",
      render: () => <WorkspaceQuickActions />,
    },
    "monthly-report": {
      id: "monthly-report",
      render: ({ reportSnapshot, reportSnapshotError, reportSnapshotLoading }) => {
        const payload = reportSnapshot?.payload ?? {};
        return (
          <FinanceReportsWidget
            title="Monthly Report"
            description="Latest generated finance snapshot."
            rows={[
              { label: "Snapshot total", value: formatTZS(Number(payload.thisTotal ?? 0)) },
              { label: "Transactions", value: String(Number(payload.transactionCount ?? 0)) },
              { label: "Categories", value: String(Number(payload.categoryCount ?? 0)) },
            ]}
            to="/finance/reports"
            isLoading={reportSnapshotLoading}
            isError={reportSnapshotError}
          />
        );
      },
    },
    "contribution-trends": {
      id: "contribution-trends",
      render: ({ summary, summaryError, summaryLoading }) => (
        <ContributionTrendWidget
          title="Contribution Trends"
          description="Recent monthly giving from dashboard metrics."
          points={summary.monthlyGiving.slice(-6)}
          formatValue={formatTZS}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "top-contribution-types": {
      id: "top-contribution-types",
      render: ({ reportSnapshot, reportSnapshotError, reportSnapshotLoading }) => {
        const payload = reportSnapshot?.payload ?? {};
        const topCategories = payload.topCategories ?? payload.categoryComparison?.map((category) => ({
          name: category.name,
          total: category.thisMonth,
        })) ?? [];

        return (
          <FinanceReportsWidget
            title="Top Contribution Types"
            description="Highest contribution categories from the latest report snapshot."
            rows={topCategories.slice(0, 5).map((category) => ({
              label: category.name,
              value: formatTZS(Number(category.total ?? 0)),
            }))}
            to="/finance/reports"
            isLoading={reportSnapshotLoading}
            isError={reportSnapshotError}
          />
        );
      },
    },
    "export-shortcuts": {
      id: "export-shortcuts",
      render: () => (
        <FinanceReportsWidget
          title="Export Shortcuts"
          description="Open report tools for CSV and detailed finance exports."
          rows={[
            { label: "Contribution detail", value: "Reports" },
            { label: "Member giving", value: "Reports" },
            { label: "Receipt list", value: "Contributions" },
          ]}
          to="/finance/reports"
        />
      ),
    },
    "platform-fees-summary": {
      id: "platform-fees-summary",
      render: ({ platformFees, platformFeesError, platformFeesLoading }) => {
        const totalFees = platformFees.reduce((sum, row) => sum + Number(row.fee_amount ?? 0), 0);
        const netAmount = platformFees.reduce((sum, row) => sum + Number(row.net_amount ?? 0), 0);

        return (
          <PlatformFeeSummaryWidget
            totalFees={formatTZS(totalFees)}
            netAmount={formatTZS(netAmount)}
            feeCount={platformFees.length}
            isLoading={platformFeesLoading}
            isError={platformFeesError}
          />
        );
      },
    },
    "audit-summary": {
      id: "audit-summary",
      render: ({ audit, auditError, auditLoading }) => (
        <AuditSummaryWidget
          count={audit.length}
          latestLabel={audit[0]?.created_at ? `Latest: ${new Date(audit[0].created_at).toLocaleDateString()}` : "No recent audit entries."}
          auditLogsPath="/finance/audit-logs"
          isLoading={auditLoading}
          isError={auditError}
        />
      ),
    },
    "finance-settings-shortcut": {
      id: "finance-settings-shortcut",
      render: () => (
        <FinanceReportsWidget
          title="Finance Settings Shortcut"
          description="Open church settings and billing controls."
          rows={[
            { label: "Contribution categories", value: "Settings" },
            { label: "Billing", value: "Settings" },
          ]}
          to="/finance/settings"
        />
      ),
    },
  };

  return (
    <WorkspaceResolver
      workspaceId="finance"
      context={context}
      widgets={widgets}
      dashboardClassName="mx-auto max-w-7xl"
    />
  );
}

function WorkspaceQuickActions() {
  const workspaceContext = useWorkspaceContext();
  const actions = useMemo(
    () =>
      (workspaceContext?.quickActions ?? []).map((action, index) => ({
        ...action,
        primary: index === 0,
      })),
    [workspaceContext?.quickActions],
  );

  return <FinanceQuickActionsWidget actions={actions} />;
}
