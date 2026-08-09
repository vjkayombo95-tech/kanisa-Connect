import { Bell, ChevronRight, Church, HandCoins, MessageCircle, Megaphone, WalletCards } from "lucide-react";

import { AnnouncementContent } from "@/components/announcements/AnnouncementContent";
import { AppLink } from "@/components/AppLink";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveMassCard } from "@/components/portal/LiveMassCard";
import { RadioLiveCard } from "@/components/portal/RadioLiveCard";
import { cn } from "@/lib/utils";

import type { MemberHomeData, NextMassSummary } from "./dashboard";
import { formatDate, formatMassTime } from "./dashboard/utils";

type MobileMemberHomeProps = {
  announcementsVisible: boolean;
  askVisible: boolean;
  giveVisible: boolean;
  home: MemberHomeData;
  isLoading: boolean;
  massSummary: NextMassSummary | undefined;
  massVisible: boolean;
};

const actions = [
  { id: "give", label: "Michango", to: "/portal/give", icon: WalletCards, color: "border-emerald-400/15 bg-emerald-500/10 text-emerald-300", iconMotion: "group-hover:-translate-y-0.5 group-active:-translate-y-0.5" },
  { id: "mass", label: "Nia ya Misa", to: "/portal/mass-intentions", icon: Church, color: "border-amber-400/15 bg-amber-500/10 text-amber-300", iconMotion: "group-hover:scale-[1.04] group-active:scale-[1.04]" },
  { id: "announcements", label: "Matangazo", to: "/portal/announcements", icon: Megaphone, color: "border-sky-400/15 bg-sky-500/10 text-sky-300", iconMotion: "group-hover:-rotate-3 group-active:-rotate-3" },
  { id: "ask", label: "Uliza Kanisa", to: "/portal/kanisa-ai", icon: MessageCircle, color: "border-violet-400/15 bg-violet-500/10 text-violet-300", iconMotion: "group-hover:scale-[1.04] group-active:scale-[1.04]" },
] as const;

export function MobileMemberHome({
  announcementsVisible,
  askVisible,
  giveVisible,
  home,
  isLoading,
  massSummary,
  massVisible,
}: MobileMemberHomeProps) {
  const firstName = home.memberName.trim().split(/\s+/)[0] || "Mshirika";
  const visibleActions = actions.filter((action) => {
    if (action.id === "give") return giveVisible;
    if (action.id === "mass") return massVisible;
    if (action.id === "announcements") return announcementsVisible;
    if (action.id === "ask") return askVisible;
    return false;
  });
  const nextMass = massSummary?.mass;

  if (isLoading) {
    return <div className="space-y-6 lg:hidden"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-36 rounded-3xl" /></div>;
  }

  return (
    <div className="relative isolate mx-auto w-full max-w-lg space-y-8 pb-24 lg:hidden" data-testid="mobile-member-home">
      <div className="pointer-events-none absolute -left-16 -top-20 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.07),transparent_68%)]" aria-hidden="true" />
      <section className="flex min-w-0 items-start gap-3 pt-1">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
          {home.churchLogoUrl ? <img src={home.churchLogoUrl} alt="" className="h-full w-full object-cover" /> : <Church className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">Kanisa Connect</p>
          <h1 className="mt-1.5 break-words text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-foreground">Habari, {firstName}</h1>
          <p className="mt-1.5 break-words text-[0.95rem] leading-5 text-muted-foreground">{home.churchName || "Parokia yako"}</p>
        </div>
        <AppLink to="/portal/announcements" aria-label="Fungua matangazo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-card/75 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.07),0_8px_24px_-18px_hsl(var(--foreground)/0.45)] backdrop-blur-sm transition duration-200 motion-reduce:transition-none hover:border-primary/25 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.97] motion-reduce:active:scale-100">
          <Bell className="h-5 w-5" />
        </AppLink>
      </section>

      <LiveMassCard churchName={home.churchName} />
      <RadioLiveCard />

      <section aria-labelledby="member-actions-title">
        <div className="flex items-end justify-between gap-3">
          <h2 id="member-actions-title" className="text-xl font-semibold tracking-tight">Ungependa kufanya nini?</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {visibleActions.map(({ id, label, to, icon: Icon, color, iconMotion }) => (
            <AppLink key={id} to={to} className="group relative flex min-h-32 overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-card/80 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.055),0_16px_32px_-28px_hsl(var(--foreground)/0.5)] backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 motion-reduce:transition-none hover:border-primary/20 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] active:border-primary/25 motion-reduce:active:scale-100" aria-label={label}>
              <span className="flex w-full flex-col justify-between">
                <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", color)}><Icon className={cn("h-6 w-6 stroke-[1.8] transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none", iconMotion)} /></span>
                <span className="mt-4 text-base font-bold leading-tight tracking-[-0.01em] text-foreground">{label}</span>
              </span>
            </AppLink>
          ))}
        </div>
        <AppLink to="/portal/services" className="group mt-3 flex min-h-12 items-center justify-end gap-1 rounded-2xl px-2 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          Huduma zote <ChevronRight className="h-4 w-4 transition-transform duration-200 motion-reduce:transition-none group-hover:translate-x-0.5 group-active:translate-x-0.5 motion-reduce:transform-none" />
        </AppLink>
      </section>

      <section className="space-y-3" aria-label="Taarifa muhimu">
        <h2 className="text-lg font-semibold tracking-tight">Inayofuata</h2>
        {nextMass ? (
          <AppLink to="/portal/calendar" className="group flex min-h-28 items-center gap-4 rounded-[1.4rem] border border-white/[0.08] bg-card/85 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.045),0_14px_30px_-28px_hsl(var(--foreground)/0.45)] transition-[transform,border-color,background-color] duration-200 motion-reduce:transition-none hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] motion-reduce:active:scale-100">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary"><Church className="h-6 w-6 stroke-[1.8]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase tracking-wider text-primary">Misa inayofuata</span><span className="mt-1 block font-bold">{nextMass.title}</span><span className="mt-1 block text-sm text-muted-foreground">{formatDate(nextMass.mass_date)} · {formatMassTime(nextMass.start_time)} · {home.churchName || "Parokia"}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none group-hover:translate-x-0.5 motion-reduce:transform-none" />
          </AppLink>
        ) : null}

        {announcementsVisible ? (
          <div className="rounded-[1.4rem] border border-border/60 bg-card/95 p-5 shadow-[0_12px_26px_-26px_hsl(var(--foreground)/0.4)]">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/10 bg-sky-500/10 text-sky-300"><Megaphone className="h-5 w-5 stroke-[1.8]" /></span><h3 className="font-bold">Tangazo la karibuni</h3></div>
            {home.latestAnnouncement ? <><p className="mt-4 font-bold">{home.latestAnnouncement.title}</p>{home.latestAnnouncement.content ? <AnnouncementContent content={home.latestAnnouncement.content} className="mt-1 line-clamp-2 text-sm text-muted-foreground" /> : null}<AppLink to="/portal/announcements" className="mt-4 inline-flex min-h-11 items-center font-bold text-primary">Tazama maelezo <ChevronRight className="ml-1 h-4 w-4" /></AppLink></> : <p className="mt-4 text-sm text-muted-foreground">Hakuna tangazo jipya kwa sasa.</p>}
          </div>
        ) : null}
      </section>

      {!nextMass && !announcementsVisible ? <div className="flex items-center gap-3 rounded-[1.4rem] border border-border/50 bg-muted/60 p-5 text-sm leading-6 text-muted-foreground"><HandCoins className="h-5 w-5 shrink-0 stroke-[1.8]" />Huduma zako zote zinapatikana kupitia “Huduma zote”.</div> : null}
    </div>
  );
}
