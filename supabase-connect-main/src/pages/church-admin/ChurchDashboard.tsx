import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Calendar,
  Church,
  Copy,
  CreditCard,
  Link2,
  MessageCircle,
  Megaphone,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ensureBirthdayAnnouncements } from "@/lib/birthday-announcements";
import { fetchChurchMessageTemplate, renderChurchMessageTemplate } from "@/lib/church-message-templates";
import { formatTZS } from "@/lib/currency";
import { readOfflineCache, withOfflineCache } from "@/lib/offline-cache";
import { openWhatsAppShare } from "@/lib/whatsapp-share";

type ContributionRow = {
  id: string;
  amount: number;
  created_at: string;
  donor_name: string | null;
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
};

type DashboardData = {
  churchName: string | null;
  churchSlug: string | null;
  totalMembers: number;
  activeMembers: number;
  announcements: AnnouncementRow[];
};

type DeferredDashboardData = {
  contributions: ContributionRow[];
  attendanceConfirmed: number;
  upcomingEvents: EventRow[];
  birthdayMembers: BirthdayMemberRow[];
};

const emptyDeferredDashboardData: DeferredDashboardData = {
  contributions: [],
  attendanceConfirmed: 0,
  upcomingEvents: [],
  birthdayMembers: [],
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function relativeDate(value: string) {
  return new Date(value).toLocaleDateString("en-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ChurchDashboard() {
  const prefersReducedMotion = useReducedMotion();
  const { churchId, profile, user } = useAuth();
  const { toast } = useToast();
  const [loadDeferredDashboardData, setLoadDeferredDashboardData] = useState(false);
  const billing = useBillingAccess({ enabled: loadDeferredDashboardData });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["church-dashboard-critical", churchId],
    queryFn: async (): Promise<DashboardData> => {
      if (!churchId) {
        return {
          churchName: null,
          churchSlug: null,
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
            supabase.from("churches").select("name, slug").eq("id", churchId).maybeSingle(),
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
            totalMembers: allMembers.count ?? 0,
            activeMembers: members.count ?? 0,
            announcements: (announcements.data ?? []) as AnnouncementRow[],
          };
        },
        readOfflineCache(cacheKey, {
          churchName: null,
          churchSlug: null,
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

  const { data: deferredData = emptyDeferredDashboardData, isLoading: isDeferredLoading } = useQuery({
    queryKey: ["church-dashboard-deferred", churchId],
    queryFn: async (): Promise<DeferredDashboardData> => {
      if (!churchId) return emptyDeferredDashboardData;

      const sixMonthsAgo = startOfMonth(new Date());
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      const today = new Date().toISOString();

      const [birthdayAutomation, birthdayCandidates, contributions, attendances, events] = await Promise.all([
        ensureBirthdayAnnouncements(churchId).catch((error) => {
          console.warn("Birthday announcement automation was deferred but failed:", error);
          return null;
        }),
        supabase
          .from("members")
          .select("id, full_name, date_of_birth")
          .eq("church_id", churchId)
          .eq("status", "active")
          .not("date_of_birth", "is", null)
          .limit(200),
        supabase
          .from("contributions")
          .select("id, amount, created_at, donor_name")
          .eq("church_id", churchId)
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("event_attendances")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
          .eq("response", "yes"),
        supabase
          .from("events")
          .select("id, title, start_date, created_at")
          .eq("church_id", churchId)
          .gte("start_date", today)
          .order("start_date", { ascending: true })
          .limit(20),
      ]);

      void birthdayAutomation;

      const failures = [birthdayCandidates.error, contributions.error, attendances.error, events.error].filter(Boolean);
      if (failures.length) {
        console.warn("Some deferred church dashboard records could not be loaded:", failures);
      }

      const todayDate = new Date();
      const birthdayMembers = ((birthdayCandidates.data ?? []) as BirthdayMemberRow[]).filter((member) => {
        if (!member.date_of_birth) return false;
        const birthDate = new Date(member.date_of_birth);
        return birthDate.getMonth() === todayDate.getMonth() && birthDate.getDate() === todayDate.getDate();
      });

      return {
        contributions: (contributions.data ?? []) as ContributionRow[],
        attendanceConfirmed: attendances.count ?? 0,
        upcomingEvents: (events.data ?? []) as EventRow[],
        birthdayMembers,
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

  const now = new Date();
  const isDeferredPending = !loadDeferredDashboardData || isDeferredLoading;
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const contributions = deferredData.contributions;
  const billingLoading = !loadDeferredDashboardData || billing.isLoading;
  const thisMonthGiving = contributions
    .filter((item) => new Date(item.created_at) >= currentMonthStart)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lastMonthGiving = contributions
    .filter((item) => {
      const date = new Date(item.created_at);
      return date >= previousMonthStart && date < currentMonthStart;
    })
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const givingDifference = thisMonthGiving - lastMonthGiving;
  const memberUsage = data?.totalMembers ?? 0;
  const memberLimit = billingLoading ? null : billing.memberLimit;
  const memberUsageRatio = memberLimit ? memberUsage / memberLimit : 0;
  const approachingMemberLimit = memberLimit !== null && memberUsageRatio >= 0.8;

  const givingBars = useMemo(() => {
    const maximumMonths = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const amount = contributions
        .filter((item) => {
          const date = new Date(item.created_at);
          return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
        })
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        month: monthDate.toLocaleDateString("en-TZ", { month: "short" }),
        amount,
      };
    });
    const highestAmount = Math.max(...maximumMonths.map((item) => item.amount), 1);
    return maximumMonths.map((item) => ({
      ...item,
      height: item.amount ? Math.max((item.amount / highestAmount) * 100, 6) : 0,
    }));
  }, [contributions, now.getFullYear(), now.getMonth()]);

  const recentActivity = useMemo(() => {
    const payments = contributions.slice(0, 5).map((item) => ({
      id: `payment-${item.id}`,
      title: `${item.donor_name || "Member"} recorded a contribution`,
      detail: formatTZS(Number(item.amount || 0)),
      date: item.created_at,
    }));
    const notices = (data?.announcements ?? []).slice(0, 5).map((item) => ({
      id: `announcement-${item.id}`,
      title: item.title,
      detail: "Announcement published",
      date: item.created_at,
    }));
    const events = deferredData.upcomingEvents.slice(0, 5).map((item) => ({
      id: `event-${item.id}`,
      title: item.title,
      detail: "Upcoming event scheduled",
      date: item.created_at,
    }));
    const birthdays = deferredData.birthdayMembers.map((member) => ({
      id: `birthday-${member.id}`,
      title: `${member.full_name} has a birthday today`,
      detail: "Birthday reminder",
      date: now.toISOString(),
      memberName: member.full_name,
    }));
    return [...birthdays, ...payments, ...notices, ...events]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 4);
  }, [contributions, data?.announcements, deferredData.birthdayMembers, deferredData.upcomingEvents, now]);

  const stats = [
    { title: "Active Members", value: String(data?.activeMembers ?? 0), label: "Registered active members", icon: Users },
    { title: "Giving This Month", value: formatTZS(thisMonthGiving), label: "Recorded contributions", icon: CreditCard },
    { title: "Confirmed Attendance", value: String(deferredData.attendanceConfirmed ?? 0), label: "Yes responses recorded", icon: Activity },
    { title: "Upcoming Events", value: String(deferredData.upcomingEvents.length ?? 0), label: "Future programs scheduled", icon: Calendar },
  ];

  const administratorName = profile?.full_name || user?.user_metadata?.full_name || "Administrator";
  const joinLink = data?.churchSlug && typeof window !== "undefined"
    ? `${window.location.origin}/join/${data.churchSlug}`
    : "";

  const copyJoinLink = async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      toast({ title: "Join link copied", description: "You can now send it to your members." });
    } catch {
      toast({ title: "Unable to copy link", description: "Select and copy the link manually.", variant: "destructive" });
    }
  };

  const shareJoinLinkOnWhatsApp = () => {
    if (!joinLink) return;
    const message = `Join ${data?.churchName || "our church"} on Kanisa Connect: ${joinLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const shareBirthdayWishOnWhatsApp = (memberName: string) => {
    if (!birthdayTemplate) return;
    openWhatsAppShare(
      renderChurchMessageTemplate(birthdayTemplate, {
        church_name: data?.churchName,
        member_name: memberName,
        date: now.toLocaleDateString("en-TZ"),
      }),
    );
  };

  return (
    <div className="relative overflow-hidden">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55 }}
        className="space-y-6"
      >
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.95)] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase text-primary">
                <Church className="h-3.5 w-3.5" />
                Dashboard
              </div>
              <h1 className="mt-5 text-3xl font-bold font-serif text-white sm:text-4xl">
                {data?.churchName || "Your Church"}
              </h1>
              <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">
                Welcome, {administratorName}. This summary reflects records entered in your workspace.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/58">This Month Giving</p>
                  {isDeferredPending && !contributions.length ? (
                    <Skeleton className="mt-3 h-14 rounded-2xl bg-white/10" />
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatTZS(thisMonthGiving)}</p>
                      <p className="mt-2 text-sm text-white/60">
                        {givingDifference === 0
                          ? "No change from last month"
                          : `${givingDifference > 0 ? "+" : ""}${formatTZS(givingDifference)} compared with last month`}
                      </p>
                    </>
                  )}
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm text-white/58">Confirmed Attendance</p>
                  {isDeferredPending ? (
                    <Skeleton className="mt-3 h-14 rounded-2xl bg-white/10" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold text-white">{deferredData.attendanceConfirmed ?? 0}</p>
                  )}
                  <p className="mt-2 text-sm text-white/60">Recorded event attendance responses</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs uppercase text-primary/80">Current Records</p>
              <p className="mt-2 text-xl font-semibold text-white">Workspace Summary</p>
              <div className="mt-6 space-y-4">
                {[
                  ["Active members", String(data?.activeMembers ?? 0)],
                  ["Recent announcements", String(data?.announcements.length ?? 0)],
                  ["Upcoming events", String(deferredData.upcomingEvents.length ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-sm text-white/72">{label}</span>
                    <span className="text-sm font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {isError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Some dashboard records could not be loaded. Refresh after confirming database access.
          </p>
        ) : null}

        <section className="rounded-[2rem] border border-primary/20 bg-primary/[0.06] p-6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Plan & Billing</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">
                  {billingLoading ? "Loading subscription..." : `${billing.currentPlanDefinition.name} Plan`}
                </h2>
                {!billingLoading && (
                  <Badge variant="outline" className="border-primary/30 text-primary capitalize">
                    {billing.currentStatus}
                  </Badge>
                )}
              </div>
              {billingLoading ? (
                <Skeleton className="mt-4 h-5 w-full max-w-md rounded bg-white/10" />
              ) : billing.isTrial && billing.subscription.expires_at ? (
                <p className="mt-3 text-sm text-white/65">
                  Trial expires on {new Date(billing.subscription.expires_at).toLocaleDateString()} ({billing.trialDaysRemaining} day(s) remaining).
                </p>
              ) : (
              <p className="mt-3 text-sm text-white/65">{billing.currentPlanDefinition.description}</p>
              )}
              {approachingMemberLimit && (
                <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                  You are approaching your member limit. Review plans before adding more members.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/65">Member usage</span>
                <span className="font-medium text-white">
                  {memberLimit === null ? `${memberUsage} / Unlimited` : `${memberUsage} / ${memberLimit}`}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(memberUsageRatio * 100, 100)}%` }} />
              </div>
              <Button asChild className="mt-5 w-full" variant={approachingMemberLimit ? "default" : "outline"}>
                <Link to="/church-admin/settings/billing">
                  {approachingMemberLimit ? "Review Upgrade Options" : "Manage Billing"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="mt-7 text-sm text-white/60">{stat.title}</p>
              {isLoading || (stat.title !== "Active Members" && isDeferredPending) ? (
                <Skeleton className="mt-3 h-9 w-28 rounded-xl bg-white/10" />
              ) : (
                <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              )}
              <p className="mt-3 text-sm text-white/58">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase text-primary/75">Member Enrollment</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Invite Members</h2>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
                Share this unique link. Members who register through it are securely joined to {data?.churchName || "your church"}.
              </p>

              {joinLink ? (
                <>
                  <Input value={joinLink} readOnly className="mt-6 h-12 border-white/10 bg-black/20 text-white" aria-label="Member join link" />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={copyJoinLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </Button>
                    <Button variant="outline" onClick={shareJoinLinkOnWhatsApp} className="border-white/15 bg-transparent">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Share on WhatsApp
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-white/62">
                  Your join link will appear after the church join-link database update is applied.
                </p>
              )}
            </div>

            <div className="flex min-h-[250px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              {joinLink ? (
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={joinLink} size={190} level="H" marginSize={2} title={`${data?.churchName || "Church"} member join link`} />
                </div>
              ) : (
                <Church className="h-12 w-12 text-white/20" />
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-primary/75">Contributions</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Giving Over Time</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-8 grid grid-cols-6 items-end gap-3">
              {isDeferredPending && !contributions.length ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-3">
                    <Skeleton className="h-52 w-full rounded-2xl bg-white/10" />
                    <Skeleton className="h-3 w-8 rounded bg-white/10" />
                  </div>
                ))
              ) : givingBars.map((bar) => (
                <div key={bar.key} className="flex flex-col items-center gap-3">
                  <div className="flex h-52 w-full items-end rounded-2xl border border-white/10 bg-black/20 p-2">
                    <div className="w-full rounded-xl bg-primary" style={{ height: `${bar.height}%` }} />
                  </div>
                  <span className="text-xs text-white/50">{bar.month}</span>
                </div>
              ))}
            </div>
            {!contributions.length ? <p className="mt-5 text-sm text-white/55">No contributions recorded yet.</p> : null}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold text-white">Recent Records</h2>
            </div>
            <div className="mt-8 space-y-4">
              {isDeferredPending && !recentActivity.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 rounded-3xl bg-white/10" />
                ))
              ) : recentActivity.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/58">{item.detail}</p>
                  <p className="mt-2 text-xs text-white/40">{relativeDate(item.date)}</p>
                  {"memberName" in item && item.memberName ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 border-white/15 bg-transparent"
                      onClick={() => shareBirthdayWishOnWhatsApp(item.memberName)}
                    >
                      <MessageCircle className="mr-2 h-3.5 w-3.5" />
                      Share Birthday Wish to WhatsApp
                    </Button>
                  ) : null}
                </div>
              ))}
              {!recentActivity.length ? (
                <p className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                  No activity has been recorded yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
