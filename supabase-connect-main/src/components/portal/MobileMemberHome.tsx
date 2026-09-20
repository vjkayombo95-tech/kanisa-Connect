import { Bell, BookOpen, CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, History, Megaphone } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { cn } from "@/lib/utils";
import type { MemberNextMass } from "@/lib/member-daily-life";
import { Skeleton } from "@/components/ui/skeleton";

type MobileMemberHomeProps = {
  announcementsVisible: boolean;
  churchBannerPositionY: number;
  churchBannerUrl: string | null;
  churchName: string | null;
  giveVisible: boolean;
  latestAnnouncement: { title: string; content: string | null } | null;
  massVisible: boolean;
  memberName: string;
  nextMass: MemberNextMass | null;
  nextMassError: boolean;
  nextMassLoading: boolean;
};

const actions = [
  { id: "give", label: "Michango", hint: "Toa mchango au sadaka", to: "/portal/give", icon: HandCoins },
  { id: "mass", label: "Nia za Misa", hint: "Wasilisha nia ya Misa", to: "/portal/mass-intentions", icon: HeartHandshake },
  { id: "announcements", label: "Matangazo", hint: "Soma taarifa za parokia", to: "/portal/announcements", icon: Megaphone },
  { id: "history", label: "Historia Yangu", hint: "Michango na wasifu", to: "/portal/dashboard", icon: History },
] as const;

export function MobileMemberHome({
  announcementsVisible,
  churchBannerPositionY,
  churchBannerUrl,
  churchName,
  giveVisible,
  latestAnnouncement,
  massVisible,
  memberName,
  nextMass,
  nextMassError,
  nextMassLoading,
}: MobileMemberHomeProps) {
  const firstName = memberName.trim().split(/\s+/)[0] || "Mshirika";
  const visibleActions = actions.filter(({ id }) => {
    if (id === "give") return giveVisible;
    if (id === "mass") return massVisible;
    if (id === "announcements") return announcementsVisible;
    return true;
  });
  const coverPositionY = Number.isFinite(churchBannerPositionY)
    ? Math.max(0, Math.min(100, Math.round(churchBannerPositionY)))
    : 38;

  return (
    <div className="mx-auto max-w-lg space-y-6 lg:hidden" data-testid="mobile-member-home">
      <ProductionLiveMassCard />

      <section
        className={cn(
          "relative flex min-w-0 items-start gap-3 overflow-hidden rounded-[28px] border border-primary/15 p-4 shadow-sm",
          churchBannerUrl
            ? "min-h-44 bg-cover text-white"
            : "bg-[linear-gradient(135deg,hsl(var(--primary)/0.13),hsl(var(--card))_65%)]",
        )}
        style={churchBannerUrl ? { backgroundImage: `url("${churchBannerUrl}")`, backgroundPosition: `center ${coverPositionY}%` } : undefined}
      >
        {churchBannerUrl ? <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" aria-hidden="true" /> : null}
        <span className={cn(
          "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
          churchBannerUrl ? "bg-white/18 text-white ring-1 ring-white/25 backdrop-blur-sm" : "bg-primary text-primary-foreground",
        )}>
          <Church className="h-6 w-6" />
        </span>
        <div className="relative z-10 min-w-0 flex-1 self-end">
          <p className={cn("text-[0.7rem] font-bold uppercase tracking-[0.2em]", churchBannerUrl ? "text-white/80" : "text-primary")}>Kanisa Connect</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">Habari, {firstName}</h1>
          <p className={cn("mt-1 truncate text-sm", churchBannerUrl ? "text-white/80" : "text-muted-foreground")}>{churchName || "Parokia yako"}</p>
        </div>
        {announcementsVisible ? (
          <AppLink
            to="/portal/announcements"
            aria-label="Fungua matangazo"
            className={cn(
              "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
              churchBannerUrl ? "border-white/25 bg-black/30 text-white backdrop-blur-sm" : "bg-card/80 text-foreground",
            )}
          >
            <Bell className="h-5 w-5" />
          </AppLink>
        ) : null}
      </section>

      <section aria-labelledby="member-actions-title">
        <h2 id="member-actions-title" className="text-xl font-semibold tracking-tight">Ungependa kufanya nini?</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {visibleActions.map(({ id, label, hint, to, icon: Icon }) => (
            <AppLink key={id} to={to} className="group flex min-h-32 flex-col justify-between rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100">
              <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary")}><Icon className="h-6 w-6" /></span>
              <span className="mt-4"><span className="block font-bold">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{hint}</span></span>
            </AppLink>
          ))}
        </div>
        <AppLink to="/portal/services" className="mt-3 flex min-h-12 items-center justify-end gap-1 rounded-2xl px-2 text-sm font-bold text-primary">
          Huduma zote <ChevronRight className="h-4 w-4" />
        </AppLink>
      </section>

      <section aria-label="Misa ijayo">
        {nextMassLoading ? <Skeleton data-testid="mobile-next-mass-loading" className="h-28 rounded-[24px]" /> : (
          <div data-testid="mobile-next-mass" className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Misa ijayo</p>
            {nextMassError ? <p className="mt-2 text-sm text-muted-foreground">Taarifa ya Misa haikupatikana</p> : nextMass ? <div className="mt-2 flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold">{nextMass.title}</h2><p className="mt-1 text-sm text-muted-foreground">{new Date(`${nextMass.massDate}T${nextMass.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}</p></div><AppLink to="/portal/calendar" className="shrink-0 rounded-xl px-2 py-2 text-sm font-bold text-primary">Ratiba</AppLink></div> : <p className="mt-2 text-sm text-muted-foreground">Hakuna Misa ijayo iliyopangwa</p>}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <AppLink to="/portal/today" className="flex min-h-20 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">Masomo ya Leo</span><span className="block text-sm text-muted-foreground">Neno la Mungu la leo</span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </AppLink>
        <AppLink to="/portal/my-parish" className="flex min-h-20 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">Parokia Yangu</span><span className="block text-sm text-muted-foreground">Misa, matukio na huduma</span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </AppLink>
        {announcementsVisible && latestAnnouncement ? (
          <AppLink to="/portal/announcements" className="rounded-[24px] border border-border/70 bg-card/85 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Tangazo la karibuni</span>
            <span className="mt-2 block font-bold">{latestAnnouncement.title}</span>
            {latestAnnouncement.content ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{latestAnnouncement.content}</span> : null}
          </AppLink>
        ) : null}
      </section>
    </div>
  );
}
