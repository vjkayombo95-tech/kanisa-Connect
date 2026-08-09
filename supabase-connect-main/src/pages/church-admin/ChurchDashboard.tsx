import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  HeartHandshake,
  Megaphone,
  Radio,
  Settings,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import {
  AnnouncementsCard,
  AttendanceSummaryWidget,
  ChurchAdminMetricWidget,
  ChurchAdminQuickActionsWidget,
  ChurchSettingsSummaryWidget,
  DashboardGreeting,
  InvitationSummaryWidget,
  MemberSignupQrWidget,
  MemberSummaryWidget,
  ParishFinanceSummaryWidget,
  PriestUpcomingEventsWidget,
  TodaysScheduleWidget,
  type DashboardWidget,
  type MemberHomeData,
  type NextMassSummary,
} from "@/components/portal/dashboard";
import { ChurchAdminActionRequiredCard } from "@/components/church-admin/ChurchAdminNotifications";
import { useWorkspaceContext, WorkspaceResolver } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_CHURCH_ADMIN_PENDING_COUNTS, useChurchAdminPendingCounts, type ChurchAdminPendingCounts } from "@/lib/church-admin-notifications";
import { EMPTY_CHURCH_FINANCIAL_SUMMARY, useChurchFinancialSummary, type ChurchFinancialSummary } from "@/lib/church-financial-summary";
import { formatTZS } from "@/lib/currency";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";

type EventRow = {
  id: string;
  title: string;
  start_date: string | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  full_name: string | null;
  created_at: string;
  date_of_birth?: string | null;
};

type InvitationRow = {
  id: string;
  status: string | null;
};

type PledgeSummaryRow = {
  total_pledged?: number | string | null;
  total_paid?: number | string | null;
  balance?: number | string | null;
};

type ChurchDashboardCriticalData = {
  churchName: string | null;
  churchSlug: string | null;
  churchCode: string | null;
  shortCode: string | null;
  totalMembers: number;
  activeMembers: number;
  latestAnnouncement: MemberHomeData["latestAnnouncement"];
};

type ChurchDashboardDeferredData = {
  attendance: {
    title: string | null;
    yes: number;
    maybe: number;
    no: number;
    responseRate: number;
    massSummary: NextMassSummary | undefined;
  };
  pendingMemberApprovals: number;
  totalMembers: number;
  newMembersThisMonth: number;
  birthdayMembers: MemberRow[];
  recentRegistrations: MemberRow[];
  todayContributions: number;
  thisMonthContributions: number;
  lifetimeContributions: number;
  contributionCount: number;
  outstandingPledges: number;
  communityHelp: {
    pending: number;
    approved: number;
  };
  upcomingEvents: EventRow[];
};

type ChurchDashboardContext = {
  churchName: string | null;
  displayName: string;
  critical: ChurchDashboardCriticalData | undefined;
  criticalError: boolean;
  criticalLoading: boolean;
  deferred: ChurchDashboardDeferredData;
  deferredError: boolean;
  deferredLoading: boolean;
  invitations: InvitationRow[];
  invitationsError: boolean;
  invitationsLoading: boolean;
  pledgeBalance: number;
  pledgeError: boolean;
  pledgeLoading: boolean;
  pendingApprovals: ChurchAdminPendingCounts;
  pendingApprovalsError: boolean;
  pendingApprovalsLoading: boolean;
  financialSummary: ChurchFinancialSummary;
  financialSummaryError: boolean;
  financialSummaryLoading: boolean;
};

const emptyDeferredData: ChurchDashboardDeferredData = {
  attendance: {
    title: null,
    yes: 0,
    maybe: 0,
    no: 0,
    responseRate: 0,
    massSummary: undefined,
  },
  pendingMemberApprovals: 0,
  totalMembers: 0,
  newMembersThisMonth: 0,
  birthdayMembers: [],
  recentRegistrations: [],
  todayContributions: 0,
  thisMonthContributions: 0,
  lifetimeContributions: 0,
  contributionCount: 0,
  outstandingPledges: 0,
  communityHelp: {
    pending: 0,
    approved: 0,
  },
  upcomingEvents: [],
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartKey() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function readContributionTotal(rows: unknown) {
  const firstRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : null;
  return Number(firstRow?.total ?? 0);
}

function pledgeBalance(rows: unknown) {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((sum, row) => {
    const pledge = row as PledgeSummaryRow;
    return sum + Number(pledge.balance ?? 0);
  }, 0);
}

function isBirthdayThisMonth(member: MemberRow) {
  if (!member.date_of_birth) return false;
  const birthday = new Date(member.date_of_birth);
  const now = new Date();
  return birthday.getMonth() === now.getMonth();
}

export default function ChurchDashboard() {
  const { churchId, profile, user } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Administrator";
  const dateKey = todayKey();
  const monthStart = monthStartKey();

  const {
    data: critical,
    isLoading: criticalLoading,
    isError: criticalError,
  } = useQuery({
    queryKey: ["church-dashboard-critical", churchId],
    queryFn: async (): Promise<ChurchDashboardCriticalData> => {
      if (!churchId) {
        return {
          churchName: null,
          churchSlug: null,
          churchCode: null,
          shortCode: null,
          totalMembers: 0,
          activeMembers: 0,
          latestAnnouncement: null,
        };
      }

      const [church, allMembers, activeMembers, announcements] = await Promise.all([
        supabase.from("churches").select("name, slug, church_code, short_code, code").eq("id", churchId).maybeSingle(),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "active"),
        fetchPortalAnnouncements(churchId, 1),
      ]);

      const latestAnnouncement = announcements[0] ?? null;

      return {
        churchName: church.data?.name ?? null,
        churchSlug: church.data?.slug ?? null,
        churchCode: church.data?.church_code ?? church.data?.code ?? null,
        shortCode: church.data?.short_code ?? null,
        totalMembers: allMembers.count ?? 0,
        activeMembers: activeMembers.count ?? 0,
        latestAnnouncement: latestAnnouncement
          ? {
              title: latestAnnouncement.title || "Announcement",
              content: latestAnnouncement.content ?? null,
              date: latestAnnouncement.created_at ?? null,
            }
          : null,
      };
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: deferred = emptyDeferredData,
    isLoading: deferredLoading,
    isError: deferredError,
  } = useQuery({
    queryKey: ["church-dashboard-deferred", churchId],
    queryFn: async (): Promise<ChurchDashboardDeferredData> => {
      if (!churchId) return emptyDeferredData;

      const [
        nextMassSummary,
        metrics,
        pendingMemberApprovals,
        newMembersThisMonth,
        recentRegistrations,
        birthdayCandidates,
        todayContributionTotal,
        lifetimeContributionTotal,
        contributionCount,
        pendingCommunityHelp,
        approvedCommunityHelp,
      ] = await Promise.all([
        supabase.rpc("get_next_mass_summary" as never, { p_church_id: churchId } as never),
        supabase.rpc("get_church_dashboard_metrics" as never, { p_church_id: churchId } as never),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId).gte("created_at", monthStart),
        supabase
          .from("members")
          .select("id, full_name, created_at")
          .eq("church_id", churchId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("members")
          .select("id, full_name, created_at, date_of_birth")
          .eq("church_id", churchId)
          .eq("status", "active")
          .not("date_of_birth", "is", null)
          .limit(200),
        supabase
          .from("contributions")
          .select("total:amount.sum()")
          .eq("church_id", churchId)
          .eq("date", dateKey),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId),
        supabase.from("contributions").select("id", { count: "exact", head: true }).eq("church_id", churchId),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "approved"),
      ]);

      const dashboardMetrics = (metrics.data ?? {}) as {
        this_month_giving?: number | string;
        upcoming_events?: EventRow[];
      };
      const massSummary = (nextMassSummary.data ?? {}) as NextMassSummary;
      const birthdayMembers = ((birthdayCandidates.data ?? []) as MemberRow[]).filter(isBirthdayThisMonth);

      return {
        attendance: {
          title: massSummary.mass?.title ?? null,
          yes: Number(massSummary.yes_count ?? 0),
          maybe: Number(massSummary.maybe_count ?? 0),
          no: Number(massSummary.no_count ?? 0),
          responseRate: Number(massSummary.response_rate ?? 0),
          massSummary,
        },
        pendingMemberApprovals: pendingMemberApprovals.count ?? 0,
        totalMembers: critical?.totalMembers ?? 0,
        newMembersThisMonth: newMembersThisMonth.count ?? 0,
        birthdayMembers,
        recentRegistrations: (recentRegistrations.data ?? []) as MemberRow[],
        todayContributions: readContributionTotal(todayContributionTotal.data),
        thisMonthContributions: Number(dashboardMetrics.this_month_giving ?? 0),
        lifetimeContributions: readContributionTotal(lifetimeContributionTotal.data),
        contributionCount: contributionCount.count ?? 0,
        outstandingPledges: 0,
        communityHelp: {
          pending: pendingCommunityHelp.count ?? 0,
          approved: approvedCommunityHelp.count ?? 0,
        },
        upcomingEvents: dashboardMetrics.upcoming_events ?? [],
      };
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsError,
  } = useQuery({
    queryKey: ["church-invitations", churchId],
    queryFn: async (): Promise<InvitationRow[]> => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("church_id", churchId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as InvitationRow[];
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: pledgeSummary = [],
    isLoading: pledgeLoading,
    isError: pledgeError,
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
    data: pendingApprovals = EMPTY_CHURCH_ADMIN_PENDING_COUNTS,
    isLoading: pendingApprovalsLoading,
    isError: pendingApprovalsError,
  } = useChurchAdminPendingCounts();

  const {
    data: financialSummary = EMPTY_CHURCH_FINANCIAL_SUMMARY,
    isLoading: financialSummaryLoading,
    isError: financialSummaryError,
  } = useChurchFinancialSummary();

  const context: ChurchDashboardContext = {
    churchName: critical?.churchName ?? null,
    displayName,
    critical,
    criticalError,
    criticalLoading,
    deferred,
    deferredError,
    deferredLoading,
    invitations,
    invitationsError,
    invitationsLoading,
    pledgeBalance: pledgeBalance(pledgeSummary),
    pledgeError,
    pledgeLoading,
    pendingApprovals,
    pendingApprovalsError,
    pendingApprovalsLoading,
    financialSummary,
    financialSummaryError,
    financialSummaryLoading,
  };

  const widgets: Record<string, DashboardWidget<ChurchDashboardContext>> = {
    greeting: {
      id: "greeting",
      render: ({ churchName, displayName }) => <DashboardGreeting memberName={displayName} churchName={churchName} />,
    },
    "todays-attendance": {
      id: "todays-attendance",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <AttendanceSummaryWidget
          confirmed={deferred.attendance.yes}
          maybe={deferred.attendance.maybe}
          responseRate={deferred.attendance.responseRate}
          eventTitle={deferred.attendance.title}
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "action-required": {
      id: "action-required",
      render: ({ pendingApprovals, pendingApprovalsError, pendingApprovalsLoading }) => (
        <ChurchAdminActionRequiredCard
          counts={pendingApprovals}
          isLoading={pendingApprovalsLoading}
          isError={pendingApprovalsError}
        />
      ),
    },
    "todays-schedule": {
      id: "todays-schedule",
      render: () => <TodaysScheduleWidget churchId={churchId} workspace="church_admin" calendarPath="/church-admin/calendar" />,
    },
    "pending-member-approvals": {
      id: "pending-member-approvals",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <ChurchAdminMetricWidget
          title="Pending Member Approvals"
          value={String(deferred.pendingMemberApprovals)}
          description="Member records waiting for review."
          icon={UserCheck}
          to="/church-admin/members"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "upcoming-events": {
      id: "upcoming-events",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <PriestUpcomingEventsWidget
          massSummary={deferred.attendance.massSummary}
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "quick-actions": {
      id: "quick-actions",
      render: () => <WorkspaceQuickActions />,
    },
    "total-members": {
      id: "total-members",
      render: ({ critical, criticalError, criticalLoading }) => (
        <ChurchAdminMetricWidget
          title="Total Members"
          value={String(critical?.totalMembers ?? 0)}
          description={`${critical?.activeMembers ?? 0} active member records.`}
          icon={Users}
          to="/church-admin/members"
          isLoading={criticalLoading}
          isError={criticalError}
        />
      ),
    },
    "new-members-this-month": {
      id: "new-members-this-month",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <ChurchAdminMetricWidget
          title="New Members This Month"
          value={String(deferred.newMembersThisMonth)}
          description="Recently created member records."
          icon={UserPlus}
          to="/church-admin/members"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    birthdays: {
      id: "birthdays",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <MemberSummaryWidget
          title="Birthdays"
          value={String(deferred.birthdayMembers.length)}
          description="Members with birthdays this month."
          members={deferred.birthdayMembers.map((member) => member.full_name || "Member")}
          to="/church-admin/members"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "recent-registrations": {
      id: "recent-registrations",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <MemberSummaryWidget
          title="Recent Registrations"
          value={String(deferred.recentRegistrations.length)}
          description="Newest member records in this parish."
          members={deferred.recentRegistrations.map((member) => member.full_name || "Member")}
          to="/church-admin/members"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "todays-contributions": {
      id: "todays-contributions",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <ChurchAdminMetricWidget
          title="Today's Contributions"
          value={formatTZS(deferred.todayContributions)}
          description="Recorded giving for today."
          icon={CircleDollarSign}
          to="/church-admin/contributions"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
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
    "outstanding-pledges": {
      id: "outstanding-pledges",
      render: ({ pledgeBalance, pledgeError, pledgeLoading }) => (
        <ChurchAdminMetricWidget
          title="Outstanding Pledges"
          value={formatTZS(pledgeBalance)}
          description="Unpaid pledge balance from pledge summaries."
          icon={Wallet}
          to="/church-admin/pledges"
          isLoading={pledgeLoading}
          isError={pledgeError}
        />
      ),
    },
    "community-help-summary": {
      id: "community-help-summary",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <ChurchAdminMetricWidget
          title="Community Help Summary"
          value={String(deferred.communityHelp.pending)}
          description={`${deferred.communityHelp.approved} approved requests currently tracked.`}
          icon={HeartHandshake}
          to="/church-admin/community-help"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    announcements: {
      id: "announcements",
      render: ({ critical }) => <AnnouncementsCard latestAnnouncement={critical?.latestAnnouncement ?? null} announcementsVisible />,
    },
    "upcoming-events-communication": {
      id: "upcoming-events-communication",
      render: ({ deferred, deferredError, deferredLoading }) => (
        <MemberSummaryWidget
          title="Upcoming Events"
          value={String(deferred.upcomingEvents.length)}
          description="Events visible to the parish calendar."
          members={deferred.upcomingEvents.map((event) => event.title)}
          to="/church-admin/events"
          isLoading={deferredLoading}
          isError={deferredError}
        />
      ),
    },
    "livestream-status": {
      id: "livestream-status",
      render: () => (
        <ChurchSettingsSummaryWidget
          title="Livestream Status"
          description="Schedule broadcasts and explicitly control LIVE status."
          statusLabel="Manage"
          to="/church-admin/livestreams"
        />
      ),
    },
    "pending-invitations": {
      id: "pending-invitations",
      render: ({ invitations, invitationsError, invitationsLoading }) => {
        const pending = invitations.filter((invitation) => invitation.status === "pending").length;
        const accepted = invitations.filter((invitation) => invitation.status === "accepted").length;
        const revoked = invitations.filter((invitation) => invitation.status === "revoked").length;

        return (
          <InvitationSummaryWidget
            pending={pending}
            accepted={accepted}
            revoked={revoked}
            isLoading={invitationsLoading}
            isError={invitationsError}
          />
        );
      },
    },
    "member-signup-qr": {
      id: "member-signup-qr",
      render: ({ critical, criticalError, criticalLoading }) => (
        <MemberSignupQrWidget
          churchName={critical?.churchName}
          churchSlug={critical?.churchSlug}
          isLoading={criticalLoading}
          isError={criticalError}
        />
      ),
    },
    "church-settings": {
      id: "church-settings",
      render: ({ critical, criticalError, criticalLoading }) => (
        <ChurchSettingsSummaryWidget
          description={critical?.churchSlug ? `Join link enabled at /join/${critical.churchSlug}.` : "Review parish profile and branding."}
          statusLabel={critical?.churchCode ? `Church Code: ${critical.churchCode}${critical.shortCode ? ` · Join Code: ${critical.shortCode}` : ""}` : critical?.churchName ?? "Church profile"}
          to="/church-admin/settings"
          isLoading={criticalLoading}
          isError={criticalError}
        />
      ),
    },
    "reports-shortcut": {
      id: "reports-shortcut",
      render: () => (
        <ChurchSettingsSummaryWidget
          title="Reports Shortcut"
          description="Open contribution and member reports for this parish."
          statusLabel="Reports"
          to="/church-admin/reports"
        />
      ),
    },
  };

  return (
    <WorkspaceResolver
      workspaceId="church_admin"
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

  return <ChurchAdminQuickActionsWidget actions={actions} />;
}
