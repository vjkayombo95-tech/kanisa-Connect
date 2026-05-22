import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  CalendarDays,
  Church,
  HandCoins,
  HeartHandshake,
  History,
  Megaphone,
  UserRound,
  Wallet,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import { formatTZS } from "@/lib/currency";
import { cn } from "@/lib/utils";

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

function getContributionCategory(row: any) {
  const category = row?.contribution_categories;
  if (Array.isArray(category)) return category[0]?.name || "Malipo";
  return category?.name || "Malipo";
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
        .maybeSingle();

      if (linkedMemberError) throw linkedMemberError;

      let member = linkedMember;
      const normalizedEmail = user.email?.trim().toLowerCase();

      if (!member && normalizedEmail) {
        const { data: emailMember, error: emailMemberError } = await supabase
          .from("members")
          .select(memberSelect)
          .ilike("email", normalizedEmail)
          .eq("church_id", churchId)
          .limit(1)
          .maybeSingle();

        if (emailMemberError) throw emailMemberError;
        member = emailMember;
      }

      if (!member) return emptyState;

      const [churchResult, contributionsResult, pledgesResult, announcementsResult] = await Promise.all([
        supabase.from("churches").select("name").eq("id", member.church_id).maybeSingle(),
        supabase
          .from("contributions")
          .select("id, amount, created_at, date, contribution_categories(name)")
          .eq("church_id", member.church_id)
          .or(`member_id.eq.${member.id},created_by.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("pledges")
          .select("id, amount_pledged, amount_paid, status")
          .eq("member_id", member.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("announcements")
          .select("id, title, content, created_at")
          .eq("church_id", member.church_id)
          .eq("is_published", true)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (churchResult.error) throw churchResult.error;
      if (contributionsResult.error) throw contributionsResult.error;
      if (pledgesResult.error) throw pledgesResult.error;
      if (announcementsResult.error) throw announcementsResult.error;

      const contributions = (contributionsResult.data ?? []) as any[];
      const pledges = (pledgesResult.data ?? []) as any[];
      const latestAnnouncement = ((announcementsResult.data ?? []) as any[])[0] ?? null;
      const lastContribution = contributions[0] ?? null;

      return {
        memberId: member.id,
        memberName: member.full_name || fallbackName,
        churchName: churchResult.data?.name ?? null,
        totalPaid: contributions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        pendingAmount: pledges.reduce(
          (sum, row) => sum + Math.max(Number(row.amount_pledged ?? 0) - Number(row.amount_paid ?? 0), 0),
          0,
        ),
        lastPayment: lastContribution
          ? {
              amount: Number(lastContribution.amount ?? 0),
              date: lastContribution.date ?? lastContribution.created_at ?? null,
              label: getContributionCategory(lastContribution),
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

  if (isLoading) return <DashboardLoadingState />;

  const home = data ?? emptyMemberHome("Mshirika");
  const giveVisible = getFeatureState("give").visible;
  const prayerVisible = getFeatureState("prayer_requests").visible;
  const massVisible = getFeatureState("mass_intentions").visible;
  const announcementsVisible = getFeatureState("announcements").visible;
  const prayerActionTo = prayerVisible ? "/portal/prayer-requests" : "/portal/mass-intentions";

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-8">
      <div className="mx-auto max-w-5xl space-y-5">
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

        <section className="grid gap-3 md:grid-cols-2">
          {giveVisible ? (
            <BigAction icon={HandCoins} label="Lipa Sasa" hint="Toa mchango au sadaka" to="/portal/give" primary />
          ) : null}
          {prayerVisible || massVisible ? (
            <BigAction icon={HeartHandshake} label="Omba Misa / Sala" hint="Tuma ombi lako kwa kanisa" to={prayerActionTo} />
          ) : null}
          <BigAction icon={History} label="Historia Yangu" hint="Angalia malipo na wasifu" to="/portal/dashboard" />
          {announcementsVisible ? (
            <BigAction icon={Megaphone} label="Matangazo" hint="Soma taarifa mpya za kanisa" to="/portal/announcements" />
          ) : null}
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
