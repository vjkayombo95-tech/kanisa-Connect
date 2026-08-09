import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AnnouncementsCard,
  DashboardStats,
  GospelHighlightCard,
  MyMinistriesCard,
  MyGivingCard,
  ParishFooter,
  ParishHero,
  ParishLifeCard,
  PrayerFocusSection,
  QuickActionsCard,
  TodaysMinistryScheduleCard,
  TodaysMassCard,
  VolunteerOpportunitiesCard,
  emptyMemberHome,
  isDeadlinePassed,
  type DashboardWidget,
  type MemberHomeData,
  type MemberJourneySummary,
  type NextMassSummary,
} from "@/components/portal/dashboard";
import { WorkspaceResolver } from "@/components/workspace";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchMemberForUser } from "@/hooks/useMember";
import { supabase } from "@/integrations/supabase/client";
import { logWarning } from "@/lib/error-logger";
import {
  fetchTodayLiturgicalReadings,
  getTodayDateKey,
  getTodayLiturgicalReadingsQueryKey,
} from "@/lib/liturgy";
import { dailyCatholicQueryOptions, livePortalQueryOptions } from "@/lib/portal-performance";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { buildTodayPrayerFromReadings, getTodayPrayerQueryKey } from "@/lib/prayers";
import { buildTodayReflectionFromReadings, getTodayReflectionQueryKey } from "@/lib/reflections";
import { fetchSaintOfDayFromLiturgy, getSaintOfDayQueryKey } from "@/lib/saints";

type ChurchHomeRow = {
  name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  metadata: unknown;
};

function readContributionTotal(rows: unknown) {
  const firstRow = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : null;
  const total = firstRow?.total;

  return Number(total ?? 0);
}

function readPendingPledgeBalance(rows: unknown) {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((sum, row) => {
    const balance = Number((row as Record<string, unknown>)?.balance ?? 0);
    return Number.isFinite(balance) ? sum + balance : sum;
  }, 0);
}

function logMemberDashboardError(label: string, error: unknown) {
  logWarning(`[MemberDashboard] ${label} could not be loaded`, {
    component: "MemberDashboard",
    metadata: { error },
  });
}

function readMetadataString(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function readSocialLinks(metadata: unknown): Array<{ label: string; url: string }> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const record = metadata as Record<string, unknown>;
  const rawLinks = record.social_links ?? record.socialLinks;

  if (Array.isArray(rawLinks)) {
    return rawLinks
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const link = item as Record<string, unknown>;
        const label = typeof link.label === "string" ? link.label : typeof link.name === "string" ? link.name : "Social";
        const url = typeof link.url === "string" ? link.url : typeof link.href === "string" ? link.href : null;
        return url ? { label, url } : null;
      })
      .filter((item): item is { label: string; url: string } => Boolean(item));
  }

  return ["facebook", "instagram", "youtube", "x", "website"]
    .map((key) => {
      const url = record[key];
      return typeof url === "string" && url.trim() ? { label: key, url: url.trim() } : null;
    })
    .filter((item): item is { label: string; url: string } => Boolean(item));
}

function useSimpleMemberHomeData() {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: ["simple-member-home", user?.id, user?.email, churchId],
    queryFn: async (): Promise<MemberHomeData> => {
      const fallbackName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Mshirika";
      const emptyState = emptyMemberHome(fallbackName);

      if (!user || !churchId) return emptyState;

      let member: { id: string; full_name: string | null; church_id: string; email: string | null } | null = null;

      try {
        member = await fetchMemberForUser({
          user,
          churchId,
          select: "id, full_name, church_id, email",
        });
      } catch (error) {
        logMemberDashboardError("member", error);
      }

      if (!member) return emptyState;

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const [
        churchResult,
        latestContributionResult,
        contributionTotalResult,
        monthlyContributionTotalResult,
        pledgeBalanceResult,
        announcementRows,
      ] = await Promise.all([
        supabase
          .from("churches")
          .select("name, logo_url, address, phone, email, metadata")
          .eq("id", member.church_id)
          .maybeSingle(),
        supabase
          .from("contributions")
          .select("id, amount, date, category_id, notes, contribution_categories!contributions_category_id_fkey(name)")
          .eq("church_id", member.church_id)
          .eq("member_id", member.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("contributions")
          .select("total:amount.sum()")
          .eq("church_id", member.church_id)
          .eq("member_id", member.id),
        supabase
          .from("contributions")
          .select("total:amount.sum()")
          .eq("church_id", member.church_id)
          .eq("member_id", member.id)
          .gte("date", monthStart),
        supabase.rpc("get_member_pledges" as never, { _member_id: member.id } as never),
        fetchPortalAnnouncements(member.church_id, 1),
      ]);

      if (churchResult.error) logMemberDashboardError("church", churchResult.error);
      if (latestContributionResult.error) logMemberDashboardError("latest contribution", latestContributionResult.error);
      if (contributionTotalResult.error) logMemberDashboardError("contribution total", contributionTotalResult.error);
      if (monthlyContributionTotalResult.error) {
        logMemberDashboardError("monthly contribution total", monthlyContributionTotalResult.error);
      }
      if (pledgeBalanceResult.error) logMemberDashboardError("pledge balance", pledgeBalanceResult.error);

      const latestContribution = (latestContributionResult.error ? null : latestContributionResult.data?.[0] ?? null) as any;
      const church = (churchResult.error ? null : churchResult.data) as ChurchHomeRow | null;
      const latestAnnouncement = announcementRows[0] ?? null;
      const totalPaid = contributionTotalResult.error ? 0 : readContributionTotal(contributionTotalResult.data);
      const totalThisMonth = monthlyContributionTotalResult.error
        ? 0
        : readContributionTotal(monthlyContributionTotalResult.data);
      const pendingAmount = pledgeBalanceResult.error ? 0 : readPendingPledgeBalance(pledgeBalanceResult.data);
      const latestPurpose =
        latestContribution?.contribution_categories?.name ||
        latestContribution?.notes?.match(/^Quick Give:\s*([^|]+)/i)?.[1]?.trim() ||
        latestContribution?.notes ||
        "General";

      return {
        memberId: member.id,
        memberName: member.full_name || fallbackName,
        churchName: church?.name ?? null,
        churchLogoUrl: church?.logo_url ?? null,
        churchAddress: church?.address ?? null,
        churchPhone: church?.phone ?? null,
        churchEmail: church?.email ?? null,
        churchOfficeHours: readMetadataString(church?.metadata, ["office_hours", "officeHours", "office"]),
        churchEmergencyContact: readMetadataString(church?.metadata, [
          "emergency_contact",
          "emergencyContact",
          "emergency_phone",
        ]),
        churchLivestreamUrl: readMetadataString(church?.metadata, [
          "livestream_url",
          "livestreamUrl",
          "live_stream_url",
          "youtube_live_url",
        ]),
        churchSocialLinks: readSocialLinks(church?.metadata),
        totalPaid,
        totalThisMonth,
        pendingAmount,
        lastPayment: latestContribution
          ? {
              amount: Number(latestContribution.amount ?? 0),
              date: latestContribution.date ?? null,
              label: "Contribution",
              purpose: latestPurpose,
              status: "Recorded",
            }
          : null,
        latestAnnouncement: latestAnnouncement
          ? {
              title: latestAnnouncement.title || "Tangazo",
              content: latestAnnouncement.content ?? null,
              date: latestAnnouncement.created_at ?? null,
            }
          : null,
      };
    },
    enabled: !!user && !!churchId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function DashboardHomeSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-52 rounded-[28px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-[28px] sm:col-span-2 lg:col-span-1" />
        <Skeleton className="h-32 rounded-[28px]" />
        <Skeleton className="h-32 rounded-[28px] sm:col-span-2 lg:col-span-2" />
      </div>
    </div>
  );
}

type MemberDashboardContext = {
  announcementsVisible: boolean;
  churchName: string | null;
  deadlinePassed: boolean;
  giveVisible: boolean;
  home: MemberHomeData;
  isError: boolean;
  isLoading: boolean;
  liturgyError: boolean;
  liturgyLoading: boolean;
  massIntentionsError: boolean;
  massIntentionsLoading: boolean;
  massIntentionsSummary: MemberJourneySummary | undefined;
  massSummary: NextMassSummary | undefined;
  massVisible: boolean;
  prayerError: boolean;
  prayerLoading: boolean;
  prayerRequestsLoading: boolean;
  prayerRequestsSummary: MemberJourneySummary | undefined;
  prayerRequestsSummaryError: boolean;
  prayerRequestsVisible: boolean;
  reflectionError: boolean;
  reflectionLoading: boolean;
  rsvpDisabled: boolean;
  saintError: boolean;
  saintFeastTitle: string;
  saintLoading: boolean;
  saintOfDay: Awaited<ReturnType<typeof fetchSaintOfDayFromLiturgy>>["saint"] | null;
  submitMassResponse: ReturnType<typeof useMutation<NextMassSummary, Error, "yes" | "maybe" | "no">>;
  todayDate: string;
  todayBooks: Awaited<ReturnType<typeof fetchTodayLiturgicalReadings>>["books"];
  todayLiturgy: Awaited<ReturnType<typeof fetchTodayLiturgicalReadings>>["day"] | null;
  todayPrayer: Awaited<ReturnType<typeof buildTodayPrayerFromReadings>> | undefined;
  todayReflection: Awaited<ReturnType<typeof buildTodayReflectionFromReadings>> | undefined;
};

export default function MemberDashboard() {
  const { data, isLoading, isError } = useSimpleMemberHomeData();
  const { getFeatureState } = useFeatureAccess();
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const home = data ?? emptyMemberHome("Mshirika");
  const todayDate = getTodayDateKey();
  const giveVisible = getFeatureState("give").visible;
  const massVisible = getFeatureState("mass_intentions").visible;
  const prayerRequestsVisible = getFeatureState("prayer_requests").visible;
  const announcementsVisible = getFeatureState("announcements").visible;

  const { data: massSummary } = useQuery({
    queryKey: ["next-mass-summary", churchId],
    queryFn: async () => {
      const { data: summary, error } = await supabase.rpc("get_next_mass_summary" as never, {
        p_church_id: churchId,
      } as never);
      if (error) throw error;
      return summary as NextMassSummary;
    },
    enabled: !!churchId,
    ...livePortalQueryOptions,
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
    data: liturgyData,
    isLoading: liturgyLoading,
    isError: liturgyError,
  } = useQuery({
    queryKey: getTodayLiturgicalReadingsQueryKey(todayDate),
    queryFn: () => fetchTodayLiturgicalReadings(todayDate),
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

  const {
    data: todayReflection,
    isLoading: reflectionLoading,
    isError: reflectionError,
  } = useQuery({
    queryKey: getTodayReflectionQueryKey(todayDate),
    queryFn: async () => {
      const readings = await queryClient.ensureQueryData({
        queryKey: getTodayLiturgicalReadingsQueryKey(todayDate),
        queryFn: () => fetchTodayLiturgicalReadings(todayDate),
        ...dailyCatholicQueryOptions,
      });
      return buildTodayReflectionFromReadings(readings, todayDate);
    },
    ...dailyCatholicQueryOptions,
  });

  const {
    data: massIntentionsSummary,
    isLoading: massIntentionsLoading,
    isError: massIntentionsError,
  } = useQuery({
    queryKey: ["my-mass-intentions-dashboard", home.memberId, churchId, "summary"],
    queryFn: async (): Promise<MemberJourneySummary> => {
      if (!churchId || !home.memberId) {
        return {
          activeCount: 0,
          latestStatus: null,
          latestDate: null,
          title: null,
          description: null,
          scheduledDate: null,
          scheduledTime: null,
          location: null,
        };
      }

      const [activeResult, latestResult] = await Promise.all([
        supabase
          .from("mass_intentions")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("member_id", home.memberId)
          .in("status", ["pending", "approved"]),
        supabase
          .from("mass_intentions")
          .select("message, intention_type, status, created_at, mass_date, mass_time, mass_name")
          .eq("church_id", churchId)
          .eq("member_id", home.memberId)
          .in("status", ["pending", "approved"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (activeResult.error) throw activeResult.error;
      if (latestResult.error) throw latestResult.error;

      const latest = latestResult.data as {
        message: string | null;
        intention_type: string | null;
        status: string | null;
        created_at: string | null;
        mass_date?: string | null;
        mass_time?: string | null;
        mass_name?: string | null;
      } | null;

      return {
        activeCount: activeResult.count ?? 0,
        latestStatus: latest?.status ?? null,
        latestDate: latest?.created_at ?? null,
        title: latest?.mass_name || latest?.intention_type || null,
        description: latest?.message ?? null,
        scheduledDate: latest?.mass_date ?? null,
        scheduledTime: latest?.mass_time ?? null,
        location: null,
      };
    },
    enabled: !!churchId && !!home.memberId && massVisible,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: prayerRequestsSummary,
    isLoading: prayerRequestsLoading,
    isError: prayerRequestsSummaryError,
  } = useQuery({
    queryKey: ["my-prayers", home.memberId, "summary"],
    queryFn: async (): Promise<MemberJourneySummary> => {
      if (!churchId || !home.memberId) {
        return {
          activeCount: 0,
          latestStatus: null,
          latestDate: null,
          title: null,
          description: null,
          scheduledDate: null,
          scheduledTime: null,
          location: null,
        };
      }

      const [activeResult, latestResult] = await Promise.all([
        supabase
          .from("prayer_requests")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("member_id", home.memberId)
          .in("status", ["pending", "approved"]),
        supabase
          .from("prayer_requests")
          .select("request_text, status, created_at")
          .eq("church_id", churchId)
          .eq("member_id", home.memberId)
          .in("status", ["pending", "approved"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (activeResult.error) throw activeResult.error;
      if (latestResult.error) throw latestResult.error;

      const latest = latestResult.data as { request_text: string | null; status: string | null; created_at: string | null } | null;

      return {
        activeCount: activeResult.count ?? 0,
        latestStatus: latest?.status ?? null,
        latestDate: latest?.created_at ?? null,
        title: latest?.request_text ?? null,
        description: null,
        scheduledDate: null,
        scheduledTime: null,
        location: null,
      };
    },
    enabled: !!churchId && !!home.memberId && prayerRequestsVisible,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const submitMassResponse = useMutation({
    mutationFn: async (response: "yes" | "maybe" | "no") => {
      if (!massSummary?.mass?.id || !home.memberId) {
        throw new Error("Mass or member record is not available.");
      }

      const { data: result, error } = await supabase.rpc("submit_mass_response" as never, {
        p_mass_event_id: massSummary.mass.id,
        p_member_id: home.memberId,
        p_response: response,
      } as never);

      if (error) throw error;
      const payload = result as NextMassSummary;
      if (!payload?.success) throw new Error(payload?.error || "Unable to submit Mass RSVP.");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["next-mass-summary"] });
      queryClient.invalidateQueries({ queryKey: ["church-dashboard-deferred"] });
    },
  });

  const nextMass = massSummary?.mass ?? null;
  const saintOfDay = saintOfDayData?.saint ?? null;
  const saintFeastTitle = saintOfDayData?.liturgicalDay?.celebration || "Saint of the Day";
  const todayLiturgy = liturgyData?.day ?? null;
  const todayBooks = liturgyData?.books ?? [];
  const deadlinePassed = isDeadlinePassed(nextMass?.response_deadline ?? null);
  const rsvpDisabled = !nextMass?.ask_for_rsvp || deadlinePassed || !home.memberId || submitMassResponse.isPending;
  const context: MemberDashboardContext = {
    announcementsVisible,
    churchName: home.churchName,
    deadlinePassed,
    giveVisible,
    home,
    isError,
    isLoading,
    liturgyError,
    liturgyLoading,
    massSummary,
    massIntentionsLoading,
    massIntentionsSummary,
    massIntentionsError,
    massVisible,
    prayerRequestsLoading,
    prayerRequestsSummary,
    prayerRequestsSummaryError,
    prayerRequestsVisible,
    prayerError,
    prayerLoading,
    reflectionError,
    reflectionLoading,
    rsvpDisabled,
    saintError,
    saintFeastTitle,
    saintLoading,
    saintOfDay,
    submitMassResponse,
    todayDate,
    todayBooks,
    todayLiturgy,
    todayPrayer,
    todayReflection,
  };

  const widgets: Record<string, DashboardWidget<MemberDashboardContext>> = {
    hero: {
      id: "hero",
      render: ({ home, todayDate, todayLiturgy }) => (
        <ParishHero home={home} todayDate={todayDate} todayLiturgy={todayLiturgy} />
      ),
    },
    "member-error": {
      id: "member-error",
      render: ({ isError }) =>
        isError ? (
          <Card className="rounded-3xl border-destructive/25 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              Hatukuweza kupakia taarifa zako kwa sasa. Jaribu tena baada ya muda mfupi.
            </CardContent>
          </Card>
        ) : null,
    },
    "giving-overview": {
      id: "giving-overview",
      render: ({
        home,
        isLoading,
        massIntentionsLoading,
        massIntentionsSummary,
        massIntentionsError,
        massSummary,
        massVisible,
        prayerRequestsLoading,
        prayerRequestsSummary,
        prayerRequestsSummaryError,
        prayerRequestsVisible,
      }) =>
        isLoading ? (
          <DashboardHomeSkeleton />
        ) : (
          <>
            <MyGivingCard home={home} />
            <DashboardStats
              massVisible={massVisible}
              churchId={churchId}
              massIntentionsError={massIntentionsError}
              massIntentionsSummary={massIntentionsSummary}
              massIntentionsLoading={massIntentionsLoading}
              prayerRequestsVisible={prayerRequestsVisible}
              prayerRequestsError={prayerRequestsSummaryError}
              prayerRequestsSummary={prayerRequestsSummary}
              prayerRequestsLoading={prayerRequestsLoading}
              massSummary={massSummary}
            />
          </>
        ),
    },
    "todays-mass": {
      id: "todays-mass",
      render: ({ deadlinePassed, home, massSummary, rsvpDisabled, submitMassResponse, todayDate }) => (
        <TodaysMassCard
          home={home}
          massSummary={massSummary}
          submitMassResponse={submitMassResponse}
          rsvpDisabled={rsvpDisabled}
          deadlinePassed={deadlinePassed}
          todayDate={todayDate}
        />
      ),
    },
    "gospel-highlight": {
      id: "gospel-highlight",
      render: ({ todayBooks, todayLiturgy }) => <GospelHighlightCard books={todayBooks} todayLiturgy={todayLiturgy} />,
    },
    "parish-life": {
      id: "parish-life",
      render: ({ home }) => <ParishLifeCard churchId={churchId} latestAnnouncement={home.latestAnnouncement} />,
    },
    "ministry-life": {
      id: "ministry-life",
      render: () => (
        <section className="grid gap-3 lg:grid-cols-3">
          <MyMinistriesCard churchId={churchId} />
          <TodaysMinistryScheduleCard churchId={churchId} />
          <VolunteerOpportunitiesCard churchId={churchId} />
        </section>
      ),
    },
    "prayer-focus": {
      id: "prayer-focus",
      render: ({
        prayerError,
        prayerLoading,
        reflectionError,
        reflectionLoading,
        saintError,
        saintFeastTitle,
        saintLoading,
        saintOfDay,
        todayPrayer,
        todayReflection,
      }) => (
        <PrayerFocusSection
          prayerError={prayerError}
          prayerLoading={prayerLoading}
          reflectionError={reflectionError}
          reflectionLoading={reflectionLoading}
          saintError={saintError}
          saintFeastTitle={saintFeastTitle}
          saintLoading={saintLoading}
          saintOfDay={saintOfDay}
          todayPrayer={todayPrayer}
          todayReflection={todayReflection}
        />
      ),
    },
    "daily-prayer-reflection": {
      id: "daily-prayer-reflection",
      render: ({ prayerError, prayerLoading, reflectionError, reflectionLoading, todayPrayer, todayReflection }) => (
        <section className="grid gap-3 md:grid-cols-2">
          <PrayerFocusSection
            prayerError={prayerError}
            prayerLoading={prayerLoading}
            todayReflection={todayReflection}
            reflectionLoading={reflectionLoading}
            reflectionError={reflectionError}
            saintError={false}
            saintFeastTitle="Saint of the Day"
            saintLoading={false}
            saintOfDay={null}
            todayPrayer={todayPrayer}
          />
        </section>
      ),
    },
    "quick-actions": {
      id: "quick-actions",
      render: ({ giveVisible, massVisible, prayerRequestsVisible }) => (
        <QuickActionsCard
          giveVisible={giveVisible}
          massVisible={massVisible}
          prayerRequestsVisible={prayerRequestsVisible}
        />
      ),
    },
    footer: {
      id: "footer",
      render: ({ home }) => <ParishFooter home={home} />,
    },
    announcements: {
      id: "announcements",
      render: ({ announcementsVisible, home, isLoading }) =>
        !isLoading ? (
          <AnnouncementsCard latestAnnouncement={home.latestAnnouncement} announcementsVisible={announcementsVisible} />
        ) : null,
    },
  };

  return (
    <WorkspaceResolver
      workspaceId="member"
      context={context}
      widgets={widgets}
      dashboardClassName="mx-auto max-w-7xl"
    />
  );
}
