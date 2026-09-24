import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Church, Copy, Link2, MessageCircle, Megaphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChurchDashboardExperience } from "@/components/church-admin/ChurchDashboardExperience";
import { ChurchDashboardMobileExperience } from "@/components/church-admin/ChurchDashboardMobileExperience";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useChurchDashboardIntelligence } from "@/hooks/use-church-dashboard-intelligence";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ensureBirthdayAnnouncements } from "@/lib/birthday-announcements";
import { fetchChurchMessageTemplate, renderChurchMessageTemplate } from "@/lib/church-message-templates";
import { formatTZS } from "@/lib/currency";
import { buildMemberJoinUrl, buildMemberJoinWhatsAppMessage } from "@/lib/invite-flow";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { getStaffMobileConfig } from "@/lib/staff-mobile-registry";
import { formatAppDate, translateStatusLabel } from "@/lib/localization";
import { openWhatsAppShare } from "@/lib/whatsapp-share";

type ContributionRow = {
  id: string;
  amount: number;
  created_at: string;
  donor_name: string | null;
};

type MonthlyGivingRow = {
  key: string;
  month: string;
  amount: number;
};

type RecentActivityBase = {
  kind: "record";
  id: string;
  title: string;
  detail: string;
  date: string;
};

type RecentMessageActivity = Omit<RecentActivityBase, "kind"> & {
  kind: "message";
  memberName: string;
  spouseName: string | null;
  messageType: "birthday" | "anniversary";
};

type RecentActivityItem = RecentActivityBase | RecentMessageActivity;

type ChurchDashboardMetrics = {
  total_members: number;
  active_members: number;
  this_month_giving: number;
  last_month_giving: number;
  monthly_giving: MonthlyGivingRow[];
  recent_contributions: ContributionRow[];
  attendance_confirmed: number;
  upcoming_events: EventRow[];
};

type NextMassSummary = {
  success?: boolean;
  mass?: {
    id: string;
    title: string;
    mass_date: string;
    start_time: string;
  } | null;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
  response_rate?: number;
};

type EventRow = {
  id: string;
  title: string;
  start_date: string;
  created_at: string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  created_at: string;
};

type BirthdayMemberRow = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  wedding_date?: string | null;
  spouse_name?: string | null;
};

type DashboardData = {
  churchName: string | null;
  churchSlug: string | null;
  bannerUrl: string | null;
  bannerPositionY: number;
  totalMembers: number;
  activeMembers: number;
  announcements: AnnouncementRow[];
};

type DeferredDashboardData = {
  thisMonthGiving: number;
  lastMonthGiving: number;
  monthlyGiving: MonthlyGivingRow[];
  recentContributions: ContributionRow[];
  attendanceConfirmed: number;
  expectedAttendance: {
    title: string | null;
    yes: number;
    maybe: number;
    no: number;
    responseRate: number;
  };
  upcomingEvents: EventRow[];
  birthdayMembers: BirthdayMemberRow[];
  anniversaryMembers: BirthdayMemberRow[];
};

const emptyDeferredDashboardData: DeferredDashboardData = {
  thisMonthGiving: 0,
  lastMonthGiving: 0,
  monthlyGiving: [],
  recentContributions: [],
  attendanceConfirmed: 0,
  expectedAttendance: {
    title: null,
    yes: 0,
    maybe: 0,
    no: 0,
    responseRate: 0,
  },
  upcomingEvents: [],
  birthdayMembers: [],
  anniversaryMembers: [],
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function ChurchDashboard() {
  const { i18n, t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { churchId, profile, staffWorkspace, user, userRole } = useAuth();
  const { toast } = useToast();
  const [loadDeferredDashboardData, setLoadDeferredDashboardData] = useState(false);
  const billing = useBillingAccess({ enabled: loadDeferredDashboardData });
  const intelligence = useChurchDashboardIntelligence();
  const mobileConfig = getStaffMobileConfig(staffWorkspace);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["church-dashboard-critical", churchId],
    queryFn: async (): Promise<DashboardData> => {
      if (!churchId) {
        return {
          churchName: null,
          churchSlug: null,
          bannerUrl: null,
          bannerPositionY: 38,
          totalMembers: 0,
          activeMembers: 0,
          announcements: [],
        };
      }

      const cacheKey = `offline-cache:church-dashboard-critical:${churchId}`;
      return withOfflineCache(
        cacheKey,
        async () => {
          const [church, allMembers, members, announcements] = await Promise.all([
            supabase.from("churches").select("name, slug, banner_url, banner_position_y").eq("id", churchId).maybeSingle(),
            supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId),
            supabase.from("members").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("status", "active"),
            supabase
              .from("announcements")
              .select("id, title, created_at")
              .eq("church_id", churchId)
              .eq("is_published", true)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

          const failures = [church.error, allMembers.error, members.error, announcements.error]
            .filter(Boolean);
          if (failures.length) {
            console.warn("Some critical church dashboard records could not be loaded:", failures);
          }

          return {
            churchName: church.data?.name ?? null,
            churchSlug: church.data?.slug ?? null,
            bannerUrl: church.data?.banner_url ?? null,
            bannerPositionY: church.data?.banner_position_y ?? 38,
            totalMembers: allMembers.count ?? 0,
            activeMembers: members.count ?? 0,
            announcements: (announcements.data ?? []) as AnnouncementRow[],
          };
        },
        readOfflineCache(cacheKey, {
          churchName: null,
          churchSlug: null,
          bannerUrl: null,
          bannerPositionY: 38,
          totalMembers: 0,
          activeMembers: 0,
          announcements: [],
        } as DashboardData),
      );
    },
    enabled: !!churchId,
  });

  useEffect(() => {
    setLoadDeferredDashboardData(false);
    if (!churchId || isLoading) return;

    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    const load = () => setLoadDeferredDashboardData(true);
    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(load, { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(load, 450);
    return () => window.clearTimeout(timeoutId);
  }, [churchId, isLoading]);

  const { data: deferredData = emptyDeferredDashboardData, isLoading: isDeferredLoading, isError: isDeferredError } = useQuery({
    queryKey: ["church-dashboard-deferred", churchId],
    queryFn: async (): Promise<DeferredDashboardData> => {
      if (!churchId) return emptyDeferredDashboardData;

      const [birthdayAutomation, birthdayCandidates, metrics, nextMassSummary] = await Promise.all([
        ensureBirthdayAnnouncements(churchId).catch((error) => {
          console.warn("Birthday announcement automation was deferred but failed:", error);
          return null;
        }),
        supabase
          .from("members")
          .select("id, full_name, date_of_birth, wedding_date, spouse_name")
          .eq("church_id", churchId)
          .eq("status", "active")
          .or("date_of_birth.not.is.null,wedding_date.not.is.null")
          .limit(200),
        supabase.rpc("get_church_dashboard_metrics" as never, { p_church_id: churchId } as never),
        supabase.rpc("get_next_mass_summary" as never, { p_church_id: churchId } as never),
      ]);

      void birthdayAutomation;

      const failures = [birthdayCandidates.error, metrics.error, nextMassSummary.error].filter(Boolean);
      if (failures.length) {
        console.warn("Some deferred church dashboard records could not be loaded:", failures);
      }

      const todayDate = new Date();
      const birthdayMembers = ((birthdayCandidates.data ?? []) as BirthdayMemberRow[]).filter((member) => {
        if (!member.date_of_birth) return false;
        const birthDate = new Date(member.date_of_birth);
        return birthDate.getMonth() === todayDate.getMonth() && birthDate.getDate() === todayDate.getDate();
      });
      const anniversaryMembers = ((birthdayCandidates.data ?? []) as BirthdayMemberRow[]).filter((member) => {
        if (!member.wedding_date) return false;
        const weddingDate = new Date(member.wedding_date);
        return weddingDate.getMonth() === todayDate.getMonth() && weddingDate.getDate() === todayDate.getDate();
      });

      const dashboardMetrics = (metrics.data ?? {}) as ChurchDashboardMetrics;
      const massSummary = (nextMassSummary.data ?? {}) as NextMassSummary;

      return {
        thisMonthGiving: Number(dashboardMetrics.this_month_giving ?? 0),
        lastMonthGiving: Number(dashboardMetrics.last_month_giving ?? 0),
        monthlyGiving: (dashboardMetrics.monthly_giving ?? []).map((row) => ({ ...row, amount: Number(row.amount ?? 0) })),
        recentContributions: (dashboardMetrics.recent_contributions ?? []).map((row) => ({ ...row, amount: Number(row.amount ?? 0) })),
        attendanceConfirmed: Number(dashboardMetrics.attendance_confirmed ?? 0),
        expectedAttendance: {
          title: massSummary.mass?.title ?? null,
          yes: Number(massSummary.yes_count ?? 0),
          maybe: Number(massSummary.maybe_count ?? 0),
          no: Number(massSummary.no_count ?? 0),
          responseRate: Number(massSummary.response_rate ?? 0),
        },
        upcomingEvents: dashboardMetrics.upcoming_events ?? [],
        birthdayMembers,
        anniversaryMembers,
      };
    },
    enabled: !!churchId && loadDeferredDashboardData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: birthdayTemplate } = useQuery({
    queryKey: ["church-message-template", churchId, "birthday_wish"],
    queryFn: () => fetchChurchMessageTemplate(churchId, "birthday_wish"),
    enabled: !!churchId && loadDeferredDashboardData,
    staleTime: 5 * 60 * 1000,
  });
  const { data: anniversaryTemplate } = useQuery({
    queryKey: ["church-message-template", churchId, "wedding_anniversary"],
    queryFn: () => fetchChurchMessageTemplate(churchId, "wedding_anniversary"),
    enabled: !!churchId && loadDeferredDashboardData,
    staleTime: 5 * 60 * 1000,
  });

  const now = useMemo(() => new Date(), []);
  const isDeferredPending = !loadDeferredDashboardData || isDeferredLoading;
  const thisMonthGiving = deferredData.thisMonthGiving;
  const monthlyGiving = deferredData.monthlyGiving;
  const recentContributions = deferredData.recentContributions;
  const hasGiving = monthlyGiving.some((item) => Number(item.amount) > 0);
  const billingLoading = !loadDeferredDashboardData || billing.isLoading;
  const memberUsage = data?.totalMembers ?? 0;
  const memberLimit = billingLoading ? null : billing.memberLimit;
  const memberUsageRatio = memberLimit ? memberUsage / memberLimit : 0;
  const approachingMemberLimit = memberLimit !== null && memberUsageRatio >= 0.8;

  const givingBars = useMemo(() => {
    const highestAmount = Math.max(...monthlyGiving.map((item) => Number(item.amount || 0)), 1);
    return monthlyGiving.map((item) => ({
      ...item,
      amount: Number(item.amount || 0),
      height: item.amount ? Math.max((Number(item.amount) / highestAmount) * 100, 6) : 0,
    }));
  }, [monthlyGiving]);

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    const payments = recentContributions.map((item) => ({
      kind: "record" as const,
      id: `payment-${item.id}`,
      title: t("church_admin_dashboard.activity.payment_title", { name: item.donor_name || t("common.member") }),
      detail: formatTZS(Number(item.amount || 0)),
      date: item.created_at,
    }));
    const notices = (data?.announcements ?? []).slice(0, 5).map((item) => ({
      kind: "record" as const,
      id: `announcement-${item.id}`,
      title: item.title,
      detail: t("church_admin_dashboard.activity.announcement_published"),
      date: item.created_at,
    }));
    const events = deferredData.upcomingEvents.slice(0, 5).map((item) => ({
      kind: "record" as const,
      id: `event-${item.id}`,
      title: item.title,
      detail: t("church_admin_dashboard.activity.upcoming_event_scheduled"),
      date: item.created_at,
    }));
    const birthdays = deferredData.birthdayMembers.map((member) => ({
      kind: "message" as const,
      id: `birthday-${member.id}`,
      title: t("church_admin_dashboard.activity.birthday_title", { name: member.full_name }),
      detail: t("church_admin_dashboard.activity.birthday_reminder"),
      date: now.toISOString(),
      memberName: member.full_name,
      spouseName: null,
      messageType: "birthday" as const,
    }));
    const anniversaries = deferredData.anniversaryMembers.map((member) => ({
      kind: "message" as const,
      id: `anniversary-${member.id}`,
      title: t("church_admin_dashboard.activity.anniversary_title", { name: member.full_name }),
      detail: t("church_admin_dashboard.activity.anniversary_reminder"),
      date: now.toISOString(),
      memberName: member.full_name,
      spouseName: member.spouse_name ?? null,
      messageType: "anniversary" as const,
    }));
    return [...birthdays, ...anniversaries, ...payments, ...notices, ...events]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 4);
  }, [data?.announcements, deferredData.anniversaryMembers, deferredData.birthdayMembers, deferredData.upcomingEvents, now, recentContributions, t]);

  const administratorName = profile?.full_name || user?.user_metadata?.full_name || t("church_admin_dashboard.defaults.administrator");
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t("church_admin_dashboard.greetings.morning")
    : hour < 18
      ? t("church_admin_dashboard.greetings.afternoon")
      : t("church_admin_dashboard.greetings.evening");
  const joinLink = buildMemberJoinUrl(data?.churchSlug) ?? "";

  const copyJoinLink = async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      toast({ title: t("church_admin_dashboard.enrollment.copy_success_title"), description: t("church_admin_dashboard.enrollment.copy_success_description") });
    } catch {
      toast({ title: t("church_admin_dashboard.enrollment.copy_error_title"), description: t("church_admin_dashboard.enrollment.copy_error_description"), variant: "destructive" });
    }
  };

  const shareJoinLinkOnWhatsApp = () => {
    if (!joinLink) return;
    openWhatsAppShare(buildMemberJoinWhatsAppMessage({ churchName: data?.churchName || t("church_admin_dashboard.defaults.our_church"), joinUrl: joinLink }));
  };

  const shareBirthdayWishOnWhatsApp = (memberName: string) => {
    if (!birthdayTemplate) return;
    openWhatsAppShare(
      renderChurchMessageTemplate(birthdayTemplate, {
        church_name: data?.churchName,
        member_name: memberName,
        date: formatAppDate(now, i18n.language),
      }),
    );
  };

  const shareAnniversaryWishOnWhatsApp = (memberName: string, spouseName: string | null) => {
    if (!anniversaryTemplate) return;
    openWhatsAppShare(
      renderChurchMessageTemplate(anniversaryTemplate, {
        church_name: data?.churchName,
        member_name: memberName,
        spouse_name: spouseName,
        date: formatAppDate(now, i18n.language),
      }),
    );
  };

  return (
    <div className="relative mx-auto max-w-7xl overflow-hidden">
      {mobileConfig ? (
        <ChurchDashboardMobileExperience
          config={mobileConfig}
          intelligence={intelligence}
          administratorName={administratorName}
          greeting={greeting}
          churchName={data?.churchName ?? null}
          bannerUrl={data?.bannerUrl ?? null}
          bannerPositionY={data?.bannerPositionY ?? 38}
          activeMembers={data?.activeMembers ?? 0}
          totalMembers={data?.totalMembers ?? 0}
          announcementCount={data?.announcements.length ?? 0}
          upcomingEventCount={deferredData.upcomingEvents.length}
          attendance={deferredData.expectedAttendance}
          criticalLoading={isLoading}
          criticalError={isError}
          deferredLoading={isDeferredPending}
          deferredError={isDeferredError}
        />
      ) : null}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55 }}
        className="hidden space-y-8 lg:block"
      >
        {isError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {t("church_admin_dashboard.errors.critical_records")}
          </p>
        ) : null}

        <ChurchDashboardExperience
          userRole={userRole}
          intelligence={intelligence}
          administratorName={administratorName}
          greeting={greeting}
          churchName={data?.churchName ?? null}
          bannerUrl={data?.bannerUrl ?? null}
          bannerPositionY={data?.bannerPositionY ?? 38}
          activeMembers={data?.activeMembers ?? 0}
          totalMembers={data?.totalMembers ?? 0}
          announcementCount={data?.announcements.length ?? 0}
          upcomingEventCount={deferredData.upcomingEvents.length}
          attendance={deferredData.expectedAttendance}
          recentActivity={recentActivity}
          criticalLoading={isLoading}
          deferredLoading={isDeferredPending}
        />

        <div className="border-t border-border/70 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("church_admin_dashboard.utilities.eyebrow")}</p>
          <h2 className="mt-2 font-serif text-xl font-semibold text-foreground">{t("church_admin_dashboard.utilities.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("church_admin_dashboard.utilities.description")}</p>
        </div>

        <section className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("church_admin_dashboard.billing.eyebrow")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">
                  {billingLoading ? t("church_admin_dashboard.billing.loading_subscription") : t("church_admin_dashboard.billing.plan_name", { plan: t(`church_admin_dashboard.billing.plans.${billing.currentPlanDefinition.id}.name`) })}
                </h2>
                {!billingLoading && (
                  <Badge variant="outline" className="border-primary/30 text-primary capitalize">
                    {translateStatusLabel(t, billing.currentStatus)}
                  </Badge>
                )}
              </div>
              {billingLoading ? (
                <Skeleton className="mt-4 h-5 w-full max-w-md rounded bg-white/10" />
              ) : billing.isTrial && billing.subscription.expires_at ? (
                <p className="mt-3 text-sm text-white/65">
                  {t("church_admin_dashboard.billing.trial_expires", {
                    date: formatAppDate(billing.subscription.expires_at, i18n.language),
                    count: billing.trialDaysRemaining,
                  })}
                </p>
              ) : (
              <p className="mt-3 text-sm text-white/65">{t(`church_admin_dashboard.billing.plans.${billing.currentPlanDefinition.id}.description`, { defaultValue: billing.currentPlanDefinition.description })}</p>
              )}
              {approachingMemberLimit && (
                <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                  {t("church_admin_dashboard.billing.member_limit_warning")}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/65">{t("church_admin_dashboard.billing.member_usage")}</span>
                <span className="font-medium text-white">
                  {memberLimit === null ? t("church_admin_dashboard.billing.member_usage_unlimited", { count: memberUsage }) : t("church_admin_dashboard.billing.member_usage_limited", { count: memberUsage, limit: memberLimit })}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(memberUsageRatio * 100, 100)}%` }} />
              </div>
              <Button asChild className="mt-5 w-full" variant={approachingMemberLimit ? "default" : "outline"}>
                <Link to="/church-admin/settings/billing">
                  {approachingMemberLimit ? t("church_admin_dashboard.billing.review_upgrade_options") : t("church_admin_dashboard.billing.manage_billing")}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase text-primary/75">{t("church_admin_dashboard.enrollment.eyebrow")}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{t("church_admin_dashboard.enrollment.title")}</h2>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
                {t("church_admin_dashboard.enrollment.description", { church: data?.churchName || t("church_admin_dashboard.defaults.your_church") })}
              </p>

              {joinLink ? (
                <>
                  <Input value={joinLink} readOnly className="mt-6 h-12 border-white/10 bg-black/20 text-white" aria-label={t("church_admin_dashboard.enrollment.join_link_label")} />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={copyJoinLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t("church_admin_dashboard.enrollment.copy_link")}
                    </Button>
                    <Button variant="outline" onClick={shareJoinLinkOnWhatsApp} className="border-white/15 bg-transparent">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {t("church_admin_dashboard.enrollment.share_whatsapp")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-white/62">
                  {t("church_admin_dashboard.enrollment.join_link_unavailable")}
                </p>
              )}
            </div>

            <div className="flex min-h-[230px] items-center justify-center rounded-2xl border border-white/[0.08] bg-black/15 p-5">
              {joinLink ? (
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={joinLink} size={190} level="H" marginSize={2} title={t("church_admin_dashboard.enrollment.qr_title", { church: data?.churchName || t("church_admin_dashboard.defaults.church") })} />
                </div>
              ) : (
                <Church className="h-12 w-12 text-white/20" />
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-primary/75">{t("church_admin_dashboard.giving.eyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t("church_admin_dashboard.giving.title")}</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-8 grid grid-cols-6 items-end gap-3">
              {isDeferredPending && !monthlyGiving.length ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-3">
                    <Skeleton className="h-52 w-full rounded-2xl bg-white/10" />
                    <Skeleton className="h-3 w-8 rounded bg-white/10" />
                  </div>
                ))
              ) : givingBars.map((bar) => (
                <div key={bar.key} className="flex flex-col items-center gap-3">
                  <div className="flex h-48 w-full items-end rounded-xl border border-white/[0.08] bg-black/15 p-2">
                    <div className="w-full rounded-xl bg-primary" style={{ height: `${bar.height}%` }} />
                  </div>
                  <span className="text-xs text-white/50">{bar.month}</span>
                </div>
              ))}
            </div>
            {!hasGiving ? <p className="mt-5 text-sm text-white/55">{t("church_admin_dashboard.giving.empty")}</p> : null}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold text-white">{t("church_admin_dashboard.records.title")}</h2>
            </div>
            <div className="mt-8 space-y-4">
              {isDeferredPending && !recentActivity.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-3xl bg-white/10" />
                ))
              ) : recentActivity.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/58">{item.detail}</p>
                  <p className="mt-2 text-xs text-white/40">{formatAppDate(item.date, i18n.language, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}</p>
                  {item.kind === "message" && item.memberName ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 border-white/15 bg-transparent"
                      onClick={() =>
                        item.messageType === "anniversary"
                          ? shareAnniversaryWishOnWhatsApp(item.memberName, item.spouseName)
                          : shareBirthdayWishOnWhatsApp(item.memberName)
                      }
                    >
                      <MessageCircle className="mr-2 h-3.5 w-3.5" />
                      {item.messageType === "anniversary" ? t("church_admin_dashboard.records.share_anniversary") : t("church_admin_dashboard.records.share_birthday")}
                    </Button>
                  ) : null}
                </div>
              ))}
              {!recentActivity.length ? (
                <p className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-sm text-white/55">
                  {t("church_admin_dashboard.records.empty")}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
