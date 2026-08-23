import { Bell, BookOpen, CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, History, Megaphone } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { cn } from "@/lib/utils";

type MobileMemberHomeProps = {
  announcementsVisible: boolean;
  churchName: string | null;
  giveVisible: boolean;
  latestAnnouncement: { title: string; content: string | null } | null;
  massVisible: boolean;
  memberName: string;
};

const actions = [
  { id: "give", label: "Michango", hint: "Toa mchango au sadaka", to: "/portal/give", icon: HandCoins },
  { id: "mass", label: "Nia za Misa", hint: "Wasilisha nia ya Misa", to: "/portal/mass-intentions", icon: HeartHandshake },
  { id: "announcements", label: "Matangazo", hint: "Soma taarifa za parokia", to: "/portal/announcements", icon: Megaphone },
  { id: "history", label: "Historia Yangu", hint: "Michango na wasifu", to: "/portal/dashboard", icon: History },
] as const;

export function MobileMemberHome({
  announcementsVisible,
  churchName,
  giveVisible,
  latestAnnouncement,
  massVisible,
  memberName,
}: MobileMemberHomeProps) {
  const firstName = memberName.trim().split(/\s+/)[0] || "Mshirika";
  const visibleActions = actions.filter(({ id }) => {
    if (id === "give") return giveVisible;
    if (id === "mass") return massVisible;
    if (id === "announcements") return announcementsVisible;
    return true;
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 lg:hidden" data-testid="mobile-member-home">
      <ProductionLiveMassCard />

      <section className="flex min-w-0 items-start gap-3 rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.13),hsl(var(--card))_65%)] p-4 shadow-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Church className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-primary">Kanisa Connect</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">Habari, {firstName}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{churchName || "Parokia yako"}</p>
        </div>
        {announcementsVisible ? (
          <AppLink to="/portal/announcements" aria-label="Fungua matangazo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card/80 text-foreground">
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
