import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  CalendarDays,
  Church,
  HandCoins,
  HeartHandshake,
  Megaphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { cn } from "@/lib/utils";
import { logWarning } from "@/lib/error-logger";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { MobileMemberHome } from "@/components/portal/MobileMemberHome";
import { fetchMemberContributionTotal } from "@/lib/member-contributions";
import { dailyLifeKeys, fetchNextMassSummary } from "@/lib/member-daily-life";
import { useIsDesktop } from "@/hooks/use-mobile";

type MemberHomeData = {
  memberId: string | null;
  memberName: string;
  churchName: string | null;
  totalPaid: number | null;
  pendingAmount: number | null;
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

type HomeQuickAction = {
  icon: LucideIcon;
  label: string;
  hint: string;
  to: string;
  primary?: boolean;
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
  totalPaid: null,
  pendingAmount: null,
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

      const [churchResult, announcementRows] = await Promise.all([
        supabase.from("churches").select("name").eq("id", member.church_id).maybeSingle(),
        fetchPortalAnnouncements(member.church_id, 1),
      ]);
      if (churchResult.error) logMemberDashboardError("church", churchResult.error);
      const latestAnnouncement = announcementRows[0] ?? null;

      return {
        memberId: member.id,
        memberName: member.full_name || fallbackName,
        churchName: churchResult.error ? null : churchResult.data?.name ?? null,
        totalPaid: null,
        pendingAmount: null,
        lastPayment: null,
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

function useMemberFinancialData(churchId: string | null, memberId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["member-home-financials", churchId, memberId],
    queryFn: async () => {
      const [latestContributionResult, contributionTotalResult, pledgeBalanceResult] = await Promise.all([
        supabase.from("contributions").select("id, amount, date, category_id").eq("church_id", churchId!).eq("member_id", memberId!).order("date", { ascending: false }).limit(1),
        fetchMemberContributionTotal(churchId!, memberId!).then((data) => ({ data, error: null })).catch((error: unknown) => ({ data: 0, error })),
        supabase.rpc("get_member_pledges" as never, { _member_id: memberId! } as never),
      ]);

      if (latestContributionResult.error) logMemberDashboardError("latest contribution", latestContributionResult.error);
      if (contributionTotalResult.error) logMemberDashboardError("contribution total", contributionTotalResult.error);
      if (pledgeBalanceResult.error) logMemberDashboardError("pledge balance", pledgeBalanceResult.error);

      if (latestContributionResult.error || contributionTotalResult.error || pledgeBalanceResult.error) {
        throw new Error("Member financial summary could not be loaded.");
      }

      const latestContribution = (latestContributionResult.error ? null : latestContributionResult.data?.[0] ?? null) as {
        amount?: number | string | null;
        date?: string | null;
      } | null;

      return {
        totalPaid: contributionTotalResult.data,
        pendingAmount: readPendingPledgeBalance(pledgeBalanceResult.data),
        lastPayment: latestContribution
          ? { amount: Number(latestContribution.amount ?? 0), date: latestContribution.date ?? null, label: "Malipo" }
          : null,
      };
    },
    enabled: enabled && !!churchId && !!memberId,
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

function FinancialMetric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function FinancialSummarySurface({
  financials,
  home,
}: {
  financials: ReturnType<typeof useMemberFinancialData>;
  home: MemberHomeData;
}) {
  return (
    <Card className="rounded-[28px] border-border/60 bg-card/80 shadow-sm">
      <CardContent className="p-4">
        <div className="grid gap-4 xl:grid-cols-3 xl:divide-x xl:divide-border/60">
          <FinancialMetric
            icon={Wallet}
            label="Jumla Uliyolipa"
            value={financials.isLoading ? "Inapakiwa" : financials.isError || home.totalPaid === null ? "Haipatikani" : formatTZS(home.totalPaid)}
            hint={financials.isError ? "Jaribu tena baada ya muda" : "Michango iliyorekodiwa"}
          />
          <div className="xl:pl-4">
            <FinancialMetric
              icon={BellRing}
              label="Kiasi Kinachosubiri"
              value={financials.isLoading ? "Inapakiwa" : financials.isError || home.pendingAmount === null ? "Haipatikani" : formatTZS(home.pendingAmount)}
              hint={financials.isError ? "Jaribu tena baada ya muda" : "Ahadi ambazo hazijakamilika"}
            />
          </div>
          <div className="xl:pl-4">
            <FinancialMetric
              icon={CalendarDays}
              label="Malipo ya Mwisho"
              value={financials.isLoading ? "Inapakiwa" : financials.isError ? "Haipatikani" : home.lastPayment ? formatTZS(home.lastPayment.amount) : "Hakuna bado"}
              hint={financials.isError ? "Jaribu tena baada ya muda" : home.lastPayment ? `${home.lastPayment.label} - ${formatDate(home.lastPayment.date)}` : "Historia itaonekana ukilipa"}
            />
          </div>
        </div>
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
  icon: LucideIcon;
  label: string;
  hint: string;
  to: string;
  primary?: boolean;
}) {
  return (
    <AppLink
      to={to}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        primary
          ? "border-primary/25 bg-primary text-primary-foreground"
          : "border-border/70 bg-card/85 text-foreground hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{label}</span>
        <span className={cn("mt-1 block text-xs", primary ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {hint}
        </span>
      </span>
    </AppLink>
  );
}

export default function MemberDashboard() {
  const isDesktop = useIsDesktop();
  const { data, isLoading, isError } = useSimpleMemberHomeData();
  const { getFeatureState } = useFeatureAccess();
  const { churchId } = useAuth();
  const queryClient = useQueryClient();
  const financials = useMemberFinancialData(churchId, data?.memberId ?? null, isDesktop);
  const home = { ...(data ?? emptyMemberHome("Mshirika")), ...(financials.data ?? {}) };

  const { data: massSummary, isLoading: massLoading, isError: massError } = useQuery({
    queryKey: dailyLifeKeys.nextMass(churchId),
    queryFn: () => fetchNextMassSummary(churchId!),
    enabled: !!churchId,
    staleTime: 60 * 1000,
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
      const payload = result as { success?: boolean; error?: string };
      if (!payload?.success) throw new Error(payload?.error || "Unable to submit Mass RSVP.");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dailyLifeKeys.nextMass(churchId) });
      queryClient.invalidateQueries({ queryKey: ["church-dashboard-deferred"] });
    },
  });

  if (isLoading) return <DashboardLoadingState />;

  const giveVisible = getFeatureState("give").visible;
  const massVisible = getFeatureState("mass_intentions").visible;
  const announcementsVisible = getFeatureState("announcements").visible;
  const nextMass = massSummary?.mass ?? null;
  const deadlinePassed = isDeadlinePassed(nextMass?.responseDeadline ?? null);
  const rsvpDisabled = !nextMass?.askForRsvp || deadlinePassed || !home.memberId || submitMassResponse.isPending;
  const quickActions: HomeQuickAction[] = [];
  if (giveVisible) quickActions.push({ icon: HandCoins, label: "Lipa Sasa", hint: "Toa mchango au sadaka", to: "/portal/give", primary: true });
  if (massVisible) quickActions.push({ icon: HeartHandshake, label: "Nia ya Misa", hint: "Wasilisha nia ya Misa", to: "/portal/mass-intentions" });
  if (announcementsVisible) quickActions.push({ icon: Megaphone, label: "Matangazo", hint: "Soma taarifa mpya", to: "/portal/announcements" });

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-8">
      <MobileMemberHome
        announcementsVisible={announcementsVisible}
        churchName={home.churchName}
        giveVisible={giveVisible}
        latestAnnouncement={home.latestAnnouncement}
        massVisible={massVisible}
        memberName={home.memberName}
        nextMass={nextMass}
        nextMassError={massError}
        nextMassLoading={massLoading}
      />
      <div className="mx-auto hidden max-w-6xl space-y-3.5 lg:block">
        <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card))_68%,hsl(var(--card)))] p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Church className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">Karibu</p>
              <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-foreground">{home.memberName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
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

        <section aria-label="Muhtasari wa michango">
          <FinancialSummarySurface financials={financials} home={home} />
        </section>

        {financials.isError ? (
          <Card className="rounded-3xl border-destructive/25 bg-destructive/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4" role="alert">
              <p className="text-sm text-destructive">Taarifa za malipo hazikuweza kupakiwa.</p>
              <Button type="button" variant="outline" onClick={() => void financials.refetch()}>Jaribu tena</Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-[28px] border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">Misa ijayo</p>
                {nextMass ? (
                  <>
                    <h2 className="mt-1 text-xl font-bold text-foreground">{nextMass.title}</h2>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {formatDate(nextMass.massDate)} · {formatMassTime(nextMass.startTime)}
                    </p>
                    {nextMass.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{nextMass.description}</p> : null}
                    {nextMass.responseDeadline ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        RSVP deadline: {new Date(nextMass.responseDeadline).toLocaleString("en-TZ")}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-foreground">Hakuna misa iliyopangwa kwa sasa.</p>
                    <p className="text-sm text-muted-foreground">Ratiba mpya itaonekana hapa itakapochapishwa.</p>
                  </div>
                )}
              </div>

              {nextMass ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Will you attend?</p>
                  <div className="flex flex-wrap gap-2">
                    {(["yes", "maybe", "no"] as const).map((response) => (
                      <Button
                        key={response}
                        variant={nextMass.memberResponse === response ? "default" : "outline"}
                        className="min-w-24 capitalize"
                        disabled={rsvpDisabled}
                        onClick={() => submitMassResponse.mutate(response)}
                      >
                        {submitMassResponse.isPending && submitMassResponse.variables === response ? "Saving..." : response}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Expected: {massSummary?.responseCounts.yes ?? 0}</span>
                    <span>Maybe: {massSummary?.responseCounts.maybe ?? 0}</span>
                    <span>Response rate: {Number(massSummary?.responseRate ?? 0).toFixed(0)}%</span>
                  </div>
                  {deadlinePassed ? <p className="text-xs text-muted-foreground">RSVP deadline has passed.</p> : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/80 shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Megaphone className="h-4 w-4" />
              </span>
              Tangazo la Karibuni
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {home.latestAnnouncement ? (
              <div>
                <p className="text-lg font-bold text-foreground">{home.latestAnnouncement.title}</p>
                {home.latestAnnouncement.content ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {home.latestAnnouncement.content}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(home.latestAnnouncement.date)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Hakuna tangazo jipya kwa sasa.</p>
            )}
            {announcementsVisible ? (
              <Button asChild variant="outline" className="h-10 rounded-xl px-4">
                <AppLink to="/portal/announcements">Fungua Matangazo</AppLink>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {quickActions.length > 0 ? (
          <section aria-label="Hatua za haraka" className="space-y-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Hatua za haraka</h2>
              <p className="text-sm text-muted-foreground">Huduma chache muhimu kwa leo.</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {quickActions.map((action) => (
                <BigAction key={action.to} {...action} />
              ))}
            </div>
          </section>
        ) : null}

        <ProductionLiveMassCard />
      </div>

    </div>
  );
}
