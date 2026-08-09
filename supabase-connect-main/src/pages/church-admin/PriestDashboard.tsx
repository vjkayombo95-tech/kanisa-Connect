import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, HeartHandshake, HelpCircle, MessageSquare } from "lucide-react";

import {
  AnnouncementsCard,
  DashboardGreeting,
  ParishFinanceSummaryWidget,
  PastoralQueueWidget,
  PriestQuickActionsWidget,
  PriestUpcomingEventsWidget,
  SaintOfTheDayCard,
  TodaysLiturgyCard,
  TodaysPrayerCard,
  TodaysScheduleWidget,
  type DashboardWidget,
  type MemberHomeData,
  type NextMassSummary,
} from "@/components/portal/dashboard";
import { WorkspaceResolver } from "@/components/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchTodayLiturgicalReadings, getTodayDateKey, getTodayLiturgicalReadingsQueryKey } from "@/lib/liturgy";
import { dailyCatholicQueryOptions, livePortalQueryOptions } from "@/lib/portal-performance";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { buildTodayPrayerFromReadings, getTodayPrayerQueryKey } from "@/lib/prayers";
import { fetchSaintOfDayFromLiturgy, getSaintOfDayQueryKey } from "@/lib/saints";
import type { SacramentalRecord } from "@/lib/sacraments";

type PriestDashboardSummary = {
  churchName: string | null;
  latestAnnouncement: MemberHomeData["latestAnnouncement"];
  massIntentions: {
    pending: number;
    today: number;
  };
  prayerRequests: {
    pending: number;
    reviewed: number;
  };
  communityHelp: {
    pending: number;
    approved: number;
  };
  sacraments: {
    upcoming: number;
    pendingCertificates: number;
  };
  finance: {
    thisMonthGiving: number;
    lifetimeGiving: number;
    contributionCount: number;
  };
};

type PriestDashboardContext = {
  churchName: string | null;
  displayName: string;
  summary: PriestDashboardSummary | undefined;
  summaryError: boolean;
  summaryLoading: boolean;
  massSummary: NextMassSummary | undefined;
  massSummaryError: boolean;
  massSummaryLoading: boolean;
  todayDate: string;
  todayLiturgy: Awaited<ReturnType<typeof fetchTodayLiturgicalReadings>>["day"] | null;
  liturgyLoading: boolean;
  liturgyError: boolean;
  saintOfDay: Awaited<ReturnType<typeof fetchSaintOfDayFromLiturgy>>["saint"] | null;
  saintFeastTitle: string;
  saintLoading: boolean;
  saintError: boolean;
  todayPrayer: Awaited<ReturnType<typeof buildTodayPrayerFromReadings>> | undefined;
  prayerLoading: boolean;
  prayerError: boolean;
};

function readContributionTotal(rows: unknown) {
  const firstRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : null;
  return Number(firstRow?.total ?? 0);
}

function emptySummary(churchName: string | null = null): PriestDashboardSummary {
  return {
    churchName,
    latestAnnouncement: null,
    massIntentions: { pending: 0, today: 0 },
    prayerRequests: { pending: 0, reviewed: 0 },
    communityHelp: { pending: 0, approved: 0 },
    sacraments: { upcoming: 0, pendingCertificates: 0 },
    finance: { thisMonthGiving: 0, lifetimeGiving: 0, contributionCount: 0 },
  };
}

export default function PriestDashboard() {
  const { churchId, profile, user } = useAuth();
  const queryClient = useQueryClient();
  const todayDate = getTodayDateKey();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Father";

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ["priest-dashboard-summary", churchId, todayDate],
    queryFn: async (): Promise<PriestDashboardSummary> => {
      if (!churchId) return emptySummary();

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const [
        church,
        pendingMassIntentions,
        todayMassIntentions,
        pendingPrayerRequests,
        reviewedPrayerRequests,
        pendingCommunityHelp,
        approvedCommunityHelp,
        monthlyGiving,
        lifetimeGiving,
        contributionCount,
        announcements,
        sacramentalRecords,
      ] = await Promise.all([
        supabase.from("churches").select("name").eq("id", churchId).maybeSingle(),
        supabase.from("mass_intentions").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("mass_intentions").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("mass_date", todayDate),
        supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).in("status", ["approved", "rejected"]),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "pending"),
        supabase.from("community_help_requests").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "approved"),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId).gte("date", monthStart),
        supabase.from("contributions").select("total:amount.sum()").eq("church_id", churchId),
        supabase.from("contributions").select("id", { count: "exact", head: true }).eq("church_id", churchId),
        fetchPortalAnnouncements(churchId, 1),
        supabase.rpc("get_sacramental_records" as never, { _church_id: churchId, _search: null } as never),
      ]);

      const latestAnnouncement = announcements[0] ?? null;
      const now = new Date();
      const sacraments = sacramentalRecords.error ? [] : ((sacramentalRecords.data ?? []) as unknown as SacramentalRecord[]);

      return {
        churchName: church.data?.name ?? null,
        latestAnnouncement: latestAnnouncement
          ? {
              title: latestAnnouncement.title || "Announcement",
              content: latestAnnouncement.content ?? null,
              date: latestAnnouncement.created_at ?? null,
            }
          : null,
        massIntentions: {
          pending: pendingMassIntentions.count ?? 0,
          today: todayMassIntentions.count ?? 0,
        },
        prayerRequests: {
          pending: pendingPrayerRequests.count ?? 0,
          reviewed: reviewedPrayerRequests.count ?? 0,
        },
        communityHelp: {
          pending: pendingCommunityHelp.count ?? 0,
          approved: approvedCommunityHelp.count ?? 0,
        },
        sacraments: {
          upcoming: sacraments.filter((record) => record.sacrament_date && new Date(record.sacrament_date) >= now).length,
          pendingCertificates: sacraments.filter((record) => record.status === "completed" || record.status === "certificate_ready").length,
        },
        finance: {
          thisMonthGiving: readContributionTotal(monthlyGiving.data),
          lifetimeGiving: readContributionTotal(lifetimeGiving.data),
          contributionCount: contributionCount.count ?? 0,
        },
      };
    },
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: massSummary,
    isLoading: massSummaryLoading,
    isError: massSummaryError,
  } = useQuery({
    queryKey: ["next-mass-summary", churchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_next_mass_summary" as never, {
        p_church_id: churchId,
      } as never);
      if (error) throw error;
      return data as NextMassSummary;
    },
    enabled: !!churchId,
    ...livePortalQueryOptions,
  });

  const {
    data: liturgyData,
    isLoading: liturgyLoading,
    isError: liturgyError,
  } = useQuery({
    queryKey: getTodayLiturgicalReadingsQueryKey(todayDate),
    queryFn: () => fetchTodayLiturgicalReadings(todayDate),
    ...dailyCatholicQueryOptions,
  });

  const {
    data: saintOfDayData,
    isLoading: saintLoading,
    isError: saintError,
  } = useQuery({
    queryKey: getSaintOfDayQueryKey(todayDate),
    queryFn: () => fetchSaintOfDayFromLiturgy(todayDate),
    ...dailyCatholicQueryOptions,
  });

  const {
    data: todayPrayer,
    isLoading: prayerLoading,
    isError: prayerError,
  } = useQuery({
    queryKey: getTodayPrayerQueryKey(todayDate),
    queryFn: async () => {
      const readings = await queryClient.ensureQueryData({
        queryKey: getTodayLiturgicalReadingsQueryKey(todayDate),
        queryFn: () => fetchTodayLiturgicalReadings(todayDate),
        ...dailyCatholicQueryOptions,
      });
      return buildTodayPrayerFromReadings(readings, todayDate);
    },
    ...dailyCatholicQueryOptions,
  });

  const context: PriestDashboardContext = {
    churchName: summary?.churchName ?? null,
    displayName,
    summary,
    summaryError,
    summaryLoading,
    massSummary,
    massSummaryError,
    massSummaryLoading,
    todayDate,
    todayLiturgy: liturgyData?.day ?? null,
    liturgyLoading,
    liturgyError,
    saintOfDay: saintOfDayData?.saint ?? null,
    saintFeastTitle: saintOfDayData?.liturgicalDay?.celebration || "Saint of the Day",
    saintLoading,
    saintError,
    todayPrayer,
    prayerLoading,
    prayerError,
  };

  const widgets: Record<string, DashboardWidget<PriestDashboardContext>> = {
    greeting: {
      id: "greeting",
      render: ({ churchName, displayName }) => <DashboardGreeting memberName={displayName} churchName={churchName} />,
    },
    "todays-liturgy": {
      id: "todays-liturgy",
      render: ({ liturgyError, liturgyLoading, todayDate, todayLiturgy }) => (
        <TodaysLiturgyCard
          todayDate={todayDate}
          todayLiturgy={todayLiturgy}
          liturgyLoading={liturgyLoading}
          liturgyError={liturgyError}
          readingsPath="/pastoral/daily-readings"
        />
      ),
    },
    "todays-schedule": {
      id: "todays-schedule",
      render: () => <TodaysScheduleWidget churchId={churchId} workspace="pastoral" calendarPath="/pastoral/calendar" />,
    },
    "todays-saint": {
      id: "todays-saint",
      render: ({ saintError, saintFeastTitle, saintLoading, saintOfDay }) => (
        <SaintOfTheDayCard
          saintOfDay={saintOfDay}
          saintFeastTitle={saintFeastTitle}
          saintLoading={saintLoading}
          saintError={saintError}
          saintPath={(saintId) => `/pastoral/saints/${saintId}`}
        />
      ),
    },
    "todays-prayer": {
      id: "todays-prayer",
      render: ({ prayerError, prayerLoading, todayPrayer }) => (
        <TodaysPrayerCard
          todayPrayer={todayPrayer}
          prayerLoading={prayerLoading}
          prayerError={prayerError}
          prayerPath={(prayerId) => `/pastoral/prayers/${prayerId}`}
        />
      ),
    },
    "mass-intentions": {
      id: "mass-intentions",
      render: ({ summary, summaryError, summaryLoading }) => (
        <PastoralQueueWidget
          title="Mass Intentions"
          description="Intentions needing pastoral review and today's scheduled intentions."
          primaryValue={summary?.massIntentions.pending ?? 0}
          primaryLabel="Pending"
          secondaryValue={summary?.massIntentions.today ?? 0}
          secondaryLabel="Today"
          to="/pastoral/mass-intentions"
          icon={HeartHandshake}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "prayer-requests": {
      id: "prayer-requests",
      render: ({ summary, summaryError, summaryLoading }) => (
        <PastoralQueueWidget
          title="Prayer Requests"
          description="Requests awaiting pastoral review and recently reviewed requests."
          primaryValue={summary?.prayerRequests.pending ?? 0}
          primaryLabel="Pending"
          secondaryValue={summary?.prayerRequests.reviewed ?? 0}
          secondaryLabel="Reviewed"
          to="/pastoral/prayer-requests"
          icon={MessageSquare}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "community-help": {
      id: "community-help",
      render: ({ summary, summaryError, summaryLoading }) => (
        <PastoralQueueWidget
          title="Community Help"
          description="Assistance requests that need review and approved active requests."
          primaryValue={summary?.communityHelp.pending ?? 0}
          primaryLabel="Pending"
          secondaryValue={summary?.communityHelp.approved ?? 0}
          secondaryLabel="Approved"
          to="/pastoral/community-help"
          icon={HelpCircle}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    sacraments: {
      id: "sacraments",
      render: ({ summary, summaryError, summaryLoading }) => (
        <PastoralQueueWidget
          title="Sacraments"
          description="Upcoming sacramental celebrations and certificates ready for pastoral follow-up."
          primaryValue={summary?.sacraments.upcoming ?? 0}
          primaryLabel="Upcoming"
          secondaryValue={summary?.sacraments.pendingCertificates ?? 0}
          secondaryLabel="Certificates"
          to="/pastoral/sacraments"
          icon={Award}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "parish-finance-summary": {
      id: "parish-finance-summary",
      render: ({ summary, summaryError, summaryLoading }) => (
        <ParishFinanceSummaryWidget
          thisMonthGiving={summary?.finance.thisMonthGiving ?? 0}
          lifetimeGiving={summary?.finance.lifetimeGiving ?? 0}
          contributionCount={summary?.finance.contributionCount ?? 0}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ),
    },
    "upcoming-events": {
      id: "upcoming-events",
      render: ({ massSummary, massSummaryError, massSummaryLoading }) => (
        <PriestUpcomingEventsWidget
          massSummary={massSummary}
          massSchedulePath="/pastoral/mass-schedule"
          isLoading={massSummaryLoading}
          isError={massSummaryError}
        />
      ),
    },
    announcements: {
      id: "announcements",
      render: ({ summary }) => (
        <AnnouncementsCard
          latestAnnouncement={summary?.latestAnnouncement ?? null}
          announcementsVisible
          announcementsPath="/pastoral/announcements"
        />
      ),
    },
    "quick-actions": {
      id: "quick-actions",
      render: () => (
        <PriestQuickActionsWidget
          paths={{
            massIntentions: "/pastoral/mass-intentions",
            prayerRequests: "/pastoral/prayer-requests",
            communityHelp: "/pastoral/community-help",
            contributions: "/pastoral/contributions",
          }}
        />
      ),
    },
  };

  return (
    <WorkspaceResolver
      workspaceId="pastoral"
      context={context}
      widgets={widgets}
      dashboardClassName="mx-auto max-w-7xl"
    />
  );
}
