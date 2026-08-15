import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  BookOpen,
  CalendarDays,
  Church,
  HandCoins,
  HeartHandshake,
  History,
  Megaphone,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { cn } from "@/lib/utils";
import { getReadableReadingDate, getTodayReadingEntry } from "@/lib/daily-readings";
import { logWarning } from "@/lib/error-logger";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { MobileMemberHome } from "@/components/portal/MobileMemberHome";
import { fetchMemberContributionTotal } from "@/lib/member-contributions";

type MemberHomeData = {
  memberId: string | null;
  memberName: string;
  churchName: string | null;
  totalPaid: number;
  pendingAmount: number;
  lastPayment: {
    amount: number;
    date: string | null;
    label: string;
  } | null;
  latestAnnouncement: {
    title: string;
    content: string | null;
    date: string | null;
  } | null;
};

type NextMassSummary = {
  success?: boolean;
  mass?: {
    id: string;
    title: string;
    description: string | null;
    mass_date: string;
    start_time: string;
    end_time: string | null;
    response_deadline: string | null;
    ask_for_rsvp: boolean;
    my_member_id: string | null;
    my_response: "yes" | "maybe" | "no" | null;
  } | null;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
  response_rate?: number;
  error?: string;
};

type SaintOfDay = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  feast_month: number;
  feast_day: number;
  patron_of: string | null;
  birth_year: number | null;
  death_year: number | null;
  country: string | null;
  biography_short: string;
  biography_long: string;
  quote: string | null;
  reflection: string;
  prayer: string;
  image_url: string | null;
  color_theme: string | null;
};

function readPendingPledgeBalance(rows: unknown) {
  if (!Array.isArray(rows)) return 0;

  return rows.reduce((sum, row) => {
    const balance = Number((row as Record<string, unknown>)?.balance ?? 0);
    return Number.isFinite(balance) ? sum + balance : sum;
  }, 0);
}

const emptyMemberHome = (name: string): MemberHomeData => ({
  memberId: null,
  memberName: name,
  churchName: null,
  totalPaid: 0,
  pendingAmount: 0,
  lastPayment: null,
  latestAnnouncement: null,
});

function formatDate(value: string | null) {
  if (!value) return "Hakuna bado";

  return new Date(value).toLocaleDateString("sw-TZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMassTime(value: string | null) {
  if (!value) return "";
  const [hours = "0", minutes = "0"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-TZ", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFeastDay(month: number, day: number) {
  return new Intl.DateTimeFormat("en-TZ", {
    month: "long",
    day: "numeric",
  }).format(new Date(2026, month - 1, day));
}

function isDeadlinePassed(value: string | null) {
  return value ? new Date(value).getTime() < Date.now() : false;
}

function logMemberDashboardError(label: string, error: unknown) {
  logWarning(`[MemberDashboard] ${label} could not be loaded`, {
    component: "MemberDashboard",
    metadata: { error },
  });
}

function useSimpleMemberHomeData() {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: ["simple-member-home", user?.id, user?.email, churchId],
    queryFn: async (): Promise<MemberHomeData> => {
      const fallbackName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Mshirika";
      const emptyState = emptyMemberHome(fallbackName);

      if (!user || !churchId) return emptyState;

      const memberSelect = "id, full_name, church_id, email";
      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("members")
        .select(memberSelect)
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .limit(1)
        .maybeSingle();

      if (linkedMemberError) logMemberDashboardError("linked member", linkedMemberError);

      let member = linkedMemberError ? null : linkedMember;
      const normalizedEmail = user.email?.trim().toLowerCase();

      if (!member && normalizedEmail) {
        const { data: emailMember, error: emailMemberError } = await supabase
          .from("members")
          .select(memberSelect)
          .ilike("email", normalizedEmail)
          .eq("church_id", churchId)
          .limit(1)
          .maybeSingle();

        if (emailMemberError) logMemberDashboardError("email member", emailMemberError);
        member = emailMemberError ? null : emailMember;
      }

      if (!member) return emptyState;

      const [churchResult, latestContributionResult, contributionTotalResult, pledgeBalanceResult, announcementRows] = await Promise.all([
        supabase.from("churches").select("name").eq("id", member.church_id).maybeSingle(),
        supabase
          .from("contributions")
          .select("id, amount, date, category_id")
          .eq("church_id", member.church_id)
          .eq("member_id", member.id)
          .order("date", { ascending: false })
          .limit(1),
        fetchMemberContributionTotal(member.church_id, member.id)
          .then((data) => ({ data, error: null }))
          .catch((error: unknown) => ({ data: 0, error })),
        supabase.rpc("get_member_pledges" as never, { _member_id: member.id } as never),
        fetchPortalAnnouncements(member.church_id, 1),
      ]);

      if (churchResult.error) logMemberDashboardError("church", churchResult.error);
      if (latestContributionResult.error) logMemberDashboardError("latest contribution", latestContributionResult.error);
      if (contributionTotalResult.error) logMemberDashboardError("contribution total", contributionTotalResult.error);
      if (pledgeBalanceResult.error) logMemberDashboardError("pledge balance", pledgeBalanceResult.error);

      const latestContribution = (latestContributionResult.error ? null : latestContributionResult.data?.[0] ?? null) as any;
      const latestAnnouncement = announcementRows[0] ?? null;
      const totalPaid = contributionTotalResult.error ? 0 : contributionTotalResult.data;
      const pendingAmount = pledgeBalanceResult.error ? 0 : readPendingPledgeBalance(pledgeBalanceResult.data);

      return {
        memberId: member.id,
        memberName: member.full_name || fallbackName,
        churchName: churchResult.error ? null : churchResult.data?.name ?? null,
        totalPaid,
        pendingAmount,
        lastPayment: latestContribution
          ? {
              amount: Number(latestContribution.amount ?? 0),
              date: latestContribution.date ?? null,
              label: "Malipo",
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

function DashboardLoadingState() {
  return (
    <div className="min-h-full bg-background px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-28 rounded-[28px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-[28px]" />
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: typeof HandCoins;
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-[28px] border-border/70 bg-card/85 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function BigAction({
  icon: Icon,
  label,
  hint,
  to,
  primary,
}: {
  icon: typeof HandCoins;
  label: string;
  hint: string;
  to: string;
  primary?: boolean;
}) {
  return (
    <AppLink
      to={to}
      className={cn(
        "flex min-h-24 items-center gap-4 rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        primary
          ? "border-primary/25 bg-primary text-primary-foreground"
          : "border-border/70 bg-card/85 text-foreground hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
          primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{label}</span>
        <span className={cn("mt-1 block text-sm", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {hint}
        </span>
      </span>
    </AppLink>
  );
}

export default function MemberDashboard() {
  const { data, isLoading, isError } = useSimpleMemberHomeData();
  const { getFeatureState } = useFeatureAccess();
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const home = data ?? emptyMemberHome("Mshirika");

  const { data: massSummary } = useQuery({
    queryKey: ["next-mass-summary", churchId],
    queryFn: async () => {
      const { data: summary, error } = await supabase.rpc("get_next_mass_summary" as never, { p_church_id: churchId } as never);
      if (error) throw error;
      return summary as NextMassSummary;
    },
    enabled: !!churchId,
    staleTime: 60 * 1000,
  });

  const { data: saintsOfDay = [], isLoading: saintLoading } = useQuery({
    queryKey: ["saint-of-the-day"],
    queryFn: async () => {
      const { data: saints, error } = await supabase.rpc("get_saint_of_the_day" as never);
      if (error) throw error;
      return (saints ?? []) as unknown as SaintOfDay[];
    },
    staleTime: 6 * 60 * 60 * 1000,
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

  if (isLoading) return <DashboardLoadingState />;

  const giveVisible = getFeatureState("give").visible;
  const massVisible = getFeatureState("mass_intentions").visible;
  const announcementsVisible = getFeatureState("announcements").visible;
  const nextMass = massSummary?.mass ?? null;
  const saintOfDay = saintsOfDay[0] ?? null;
  const todayReading = getTodayReadingEntry();
  const firstReading = todayReading.readings.find((reading) => reading.id === "first");
  const psalmReading = todayReading.readings.find((reading) => reading.id === "psalm");
  const secondReading = todayReading.readings.find((reading) => reading.id === "second");
  const gospelReading = todayReading.readings.find((reading) => reading.id === "gospel");
  const deadlinePassed = isDeadlinePassed(nextMass?.response_deadline ?? null);
  const rsvpDisabled = !nextMass?.ask_for_rsvp || deadlinePassed || !home.memberId || submitMassResponse.isPending;

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-8">
      <MobileMemberHome
        announcementsVisible={announcementsVisible}
        churchName={home.churchName}
        giveVisible={giveVisible}
        latestAnnouncement={home.latestAnnouncement}
        massVisible={massVisible}
        memberName={home.memberName}
      />
      <div className="mx-auto hidden max-w-5xl space-y-5 lg:block">
        <ProductionLiveMassCard />
        <section className="overflow-hidden rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.15),hsl(var(--card))_58%,hsl(var(--card)))] p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Church className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">Karibu</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{home.memberName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {home.churchName ? home.churchName : "Huduma yako ya kanisa iko hapa kwa urahisi."}
              </p>
            </div>
          </div>
        </section>

        {isError ? (
          <Card className="rounded-3xl border-destructive/25 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              Hatukuweza kupakia taarifa zako kwa sasa. Jaribu tena baada ya muda mfupi.
            </CardContent>
          </Card>
        ) : null}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            icon={Wallet}
            label="Jumla Uliyolipa"
            value={formatTZS(home.totalPaid)}
            hint="Michango iliyorekodiwa"
            className="sm:col-span-2 lg:col-span-1"
          />
          <SummaryTile
            icon={BellRing}
            label="Kiasi Kinachosubiri"
            value={formatTZS(home.pendingAmount)}
            hint="Ahadi ambazo hazijakamilika"
          />
          <SummaryTile
            icon={CalendarDays}
            label="Malipo ya Mwisho"
            value={home.lastPayment ? formatTZS(home.lastPayment.amount) : "Hakuna bado"}
            hint={home.lastPayment ? `${home.lastPayment.label} - ${formatDate(home.lastPayment.date)}` : "Historia itaonekana ukilipa"}
            className="sm:col-span-2 lg:col-span-2"
          />
        </section>

        <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Upcoming Mass</p>
                {nextMass ? (
                  <>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{nextMass.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(nextMass.mass_date)} · {formatMassTime(nextMass.start_time)}
                    </p>
                    {nextMass.response_deadline ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        RSVP deadline: {new Date(nextMass.response_deadline).toLocaleString("en-TZ")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No upcoming Mass scheduled.</p>
                )}
              </div>

              {nextMass ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Will you attend?</p>
                  <div className="flex flex-wrap gap-2">
                    {(["yes", "maybe", "no"] as const).map((response) => (
                      <Button
                        key={response}
                        variant={nextMass.my_response === response ? "default" : "outline"}
                        className="min-w-24 capitalize"
                        disabled={rsvpDisabled}
                        onClick={() => submitMassResponse.mutate(response)}
                      >
                        {submitMassResponse.isPending && submitMassResponse.variables === response ? "Saving..." : response}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Expected: {massSummary?.yes_count ?? 0}</span>
                    <span>Maybe: {massSummary?.maybe_count ?? 0}</span>
                    <span>Response rate: {Number(massSummary?.response_rate ?? 0).toFixed(0)}%</span>
                  </div>
                  {deadlinePassed ? <p className="text-xs text-muted-foreground">RSVP deadline has passed.</p> : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-card/85 shadow-sm">
          <CardContent className="p-0">
            {saintLoading ? (
              <div className="p-5">
                <Skeleton className="h-36 rounded-3xl" />
              </div>
            ) : saintOfDay ? (
              <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                {saintOfDay.image_url ? (
                  <img
                    src={saintOfDay.image_url}
                    alt={saintOfDay.name}
                    className="h-56 w-full object-cover md:h-full"
                  />
                ) : (
                  <div className="flex h-56 w-full items-center justify-center bg-primary/10 text-primary md:h-full">
                    <Sparkles className="h-12 w-12" />
                  </div>
                )}
                <div className="space-y-4 p-5">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-primary">
                      <span aria-hidden="true">🌟</span>
                      Saint of the Day
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{saintOfDay.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Feast Day: {formatFeastDay(saintOfDay.feast_month, saintOfDay.feast_day)}
                    </p>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{saintOfDay.biography_short}</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reflection</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-foreground">{saintOfDay.reflection}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prayer</p>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-foreground">{saintOfDay.prayer}</p>
                    </div>
                  </div>
                  {saintOfDay.quote ? (
                    <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/5 p-3 text-sm italic text-foreground">
                      "{saintOfDay.quote}"
                    </blockquote>
                  ) : null}
                  <Button asChild variant="outline" className="h-11 rounded-2xl">
                    <Link to={`/member/library/${saintOfDay.slug}`}>Read More</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-primary">
                    <span aria-hidden="true">🌟</span>
                    Saint of the Day
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">No saint has been configured for today.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <BookOpen className="h-4 w-4" />
                  Today's Readings
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">{getReadableReadingDate(todayReading)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {todayReading.liturgicalSeason || "Liturgical season pending"}
                </p>
              </div>
              <Button asChild variant="outline" className="h-11 rounded-2xl">
                <AppLink to="/portal/daily-readings">Read More</AppLink>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                firstReading,
                psalmReading,
                secondReading,
                gospelReading,
              ]
                .filter(Boolean)
                .map((reading) => (
                  <div key={reading!.id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{reading!.title}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{reading!.reference}</p>
                  </div>
                ))}
            </div>

            <div className="rounded-2xl bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Reflection</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{todayReading.reflection}</p>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 md:grid-cols-2">
          {giveVisible ? (
            <BigAction icon={HandCoins} label="Lipa Sasa" hint="Toa mchango au sadaka" to="/portal/give" primary />
          ) : null}
          {massVisible ? (
            <BigAction icon={HeartHandshake} label="Nia za Misa" hint="Wasilisha nia ya Misa na sadaka" to="/portal/mass-intentions" />
          ) : null}
          <BigAction icon={History} label="Historia Yangu" hint="Angalia malipo na wasifu" to="/portal/dashboard" />
          {announcementsVisible ? (
            <BigAction icon={Megaphone} label="Matangazo" hint="Soma taarifa mpya za kanisa" to="/portal/announcements" />
          ) : null}
          <BigAction icon={BookOpen} label="Daily Readings" hint="The Word of God for today" to="/portal/daily-readings" />
          <BigAction icon={BookOpen} label="Catholic Library" hint="Lives of saints and prayers" to="/member/library" />
        </section>

        <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Megaphone className="h-5 w-5" />
              </span>
              Tangazo la Karibuni
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {home.latestAnnouncement ? (
              <div>
                <p className="text-xl font-bold text-foreground">{home.latestAnnouncement.title}</p>
                {home.latestAnnouncement.content ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {home.latestAnnouncement.content}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{formatDate(home.latestAnnouncement.date)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Hakuna tangazo jipya kwa sasa.</p>
            )}
            {announcementsVisible ? (
              <Button asChild variant="outline" className="h-12 rounded-2xl px-5">
                <AppLink to="/portal/announcements">Fungua Matangazo</AppLink>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Wasifu na malipo yako</p>
              <p className="mt-1 text-sm text-muted-foreground">Taarifa zaidi zipo kwenye Historia Yangu.</p>
            </div>
            <Button asChild size="sm" className="h-10 shrink-0 rounded-xl">
              <AppLink to="/portal/dashboard">Fungua</AppLink>
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
