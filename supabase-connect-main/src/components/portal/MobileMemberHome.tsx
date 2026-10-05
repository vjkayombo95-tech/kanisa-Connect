import { Bell, BookOpen, CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, History, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { announcementHtmlToPlainText } from "@/lib/announcement-content";
import { cn } from "@/lib/utils";
import type { MemberNextMass } from "@/lib/member-daily-life";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAppDate, translateMemberServiceDescription, translateMemberServiceLabel } from "@/lib/localization";
import { memberServiceRegistry } from "@/lib/member-service-registry";

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
  { id: "give", serviceId: "give", to: "/portal/give", icon: HandCoins },
  { id: "mass", serviceId: "mass-intentions", to: "/portal/mass-intentions", icon: HeartHandshake },
  { id: "announcements", serviceId: "announcements", to: "/portal/announcements", icon: Megaphone },
  { id: "history", serviceId: "dashboard", to: "/portal/dashboard", icon: History },
] as const;

function getMemberService(serviceId: string) {
  const service = memberServiceRegistry.find((item) => item.id === serviceId);
  if (!service) throw new Error(`Missing member service registry entry: ${serviceId}`);
  return service;
}

function formatMassDateTime(mass: MemberNextMass, language: string) {
  return formatAppDate(`${mass.massDate}T${mass.startTime}+03:00`, language, { dateStyle: "medium", timeStyle: "short" });
}

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
  const { t, i18n } = useTranslation();
  const firstName = memberName.trim().split(/\s+/)[0] || t("member_home.greeting.member_fallback");
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
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">{t("member_home.mobile.hello", { name: firstName })}</h1>
          <p className={cn("mt-1 truncate text-sm", churchBannerUrl ? "text-white/80" : "text-muted-foreground")}>{churchName || t("member_home.greeting.parish_fallback")}</p>
        </div>
        {announcementsVisible ? (
          <AppLink
            to="/portal/announcements"
            aria-label={t("member_home.mobile.open_announcements")}
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
        <h2 id="member-actions-title" className="text-xl font-semibold tracking-tight">{t("member_home.mobile.prompt")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {visibleActions.map(({ id, serviceId, to, icon: Icon }) => {
            const service = getMemberService(serviceId);
            return (
            <AppLink key={id} to={to} className="group flex min-h-32 flex-col justify-between rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100">
              <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary")}><Icon className="h-6 w-6" /></span>
              <span className="mt-4"><span className="block font-bold">{translateMemberServiceLabel(t, service)}</span><span className="mt-1 block text-xs text-muted-foreground">{translateMemberServiceDescription(t, service)}</span></span>
            </AppLink>
            );
          })}
        </div>
        <AppLink to="/portal/services" className="mt-3 flex min-h-12 items-center justify-end gap-1 rounded-2xl px-2 text-sm font-bold text-primary">
          {t("member_services.services.description")} <ChevronRight className="h-4 w-4" />
        </AppLink>
      </section>

      <section aria-label={t("member_my_parish.sections.next_mass")}>
        {nextMassLoading ? <Skeleton data-testid="mobile-next-mass-loading" className="h-28 rounded-[24px]" /> : (
          <div data-testid="mobile-next-mass" className="rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{t("member_my_parish.sections.next_mass")}</p>
            {nextMassError ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("member_my_parish.errors.mass_title")}</p>
            ) : nextMass ? (
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-bold">{nextMass.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{formatMassDateTime(nextMass, i18n.language)}</p>
                  {nextMass.description ? <p className="mt-1 break-words text-sm text-muted-foreground">{nextMass.description}</p> : null}
                </div>
                <AppLink to="/portal/calendar" className="shrink-0 rounded-xl px-2 py-2 text-sm font-bold text-primary">{t("member_my_parish.actions.schedule")}</AppLink>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("member_my_parish.empty.next_mass")}</p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <AppLink to="/portal/today" className="flex min-h-20 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">{translateMemberServiceLabel(t, getMemberService("daily-readings"))}</span><span className="block text-sm text-muted-foreground">{translateMemberServiceDescription(t, getMemberService("daily-readings"))}</span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </AppLink>
        <AppLink to="/portal/my-parish" className="flex min-h-20 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-bold">{translateMemberServiceLabel(t, getMemberService("my-parish"))}</span><span className="block text-sm text-muted-foreground">{translateMemberServiceDescription(t, getMemberService("my-parish"))}</span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </AppLink>
        {announcementsVisible && latestAnnouncement ? (
          <AppLink to="/portal/announcements" className="rounded-[24px] border border-border/70 bg-card/85 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">{t("member_my_parish.sections.latest_announcement")}</span>
            <span className="mt-2 block font-bold">{latestAnnouncement.title || t("member_my_parish.fallbacks.announcement")}</span>
            {latestAnnouncement.content ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{announcementHtmlToPlainText(latestAnnouncement.content)}</span> : null}
          </AppLink>
        ) : null}
      </section>
    </div>
  );
}
