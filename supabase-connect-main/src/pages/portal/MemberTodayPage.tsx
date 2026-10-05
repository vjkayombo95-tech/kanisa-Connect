import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { DailyReadingReferenceList } from "@/components/portal/daily-readings/DailyReadingPresentation";
import { ReadingCard } from "@/components/portal/daily-readings/ReadingCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";
import { announcementHtmlToPlainText } from "@/lib/announcement-content";
import {
  fetchPublishedDailyReading,
  isDailyReadingSectionActionable,
  publishedDailyReadingKey,
  useTanzaniaMemberDate,
  type DailyReadingSection,
} from "@/lib/daily-readings";
import { formatAppDate, translateMemberServiceDescription, translateMemberServiceLabel } from "@/lib/localization";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextTimetableMass, fetchParishEvents, isEventToday } from "@/lib/member-daily-life";
import { memberServiceRegistry, type MemberServiceDefinition } from "@/lib/member-service-registry";

function Summary({ title, children, to }: { title: string; children: React.ReactNode; to?: string }) {
  const body = <Card className="h-full rounded-[26px] border-border/70 bg-card/85"><CardContent className="p-5"><h2 className="text-lg font-bold">{title}</h2><div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div></CardContent></Card>;
  return to ? <AppLink to={to} className="block h-full">{body}</AppLink> : body;
}

type TodayReadingPreviewItem =
  | { type: "references"; readings: DailyReadingSection[] }
  | { type: "card"; reading: DailyReadingSection; defaultOpen: boolean };

const TODAY_QUICK_ACTIONS = [
  { serviceId: "bible", to: "/portal/bible", icon: BookOpen },
  { serviceId: "prayers", to: "/portal/prayers", icon: Sparkles },
  { serviceId: "liturgical-calendar", to: "/portal/liturgical-calendar", icon: CalendarDays },
] as const;

function getTodayReadingPreviewItems(readings: DailyReadingSection[]) {
  const items: TodayReadingPreviewItem[] = [];
  let referenceGroup: DailyReadingSection[] = [];
  let cardCount = 0;

  const flushReferences = () => {
    if (!referenceGroup.length) return;
    items.push({ type: "references", readings: referenceGroup });
    referenceGroup = [];
  };

  for (const reading of readings) {
    if (isDailyReadingSectionActionable(reading)) {
      flushReferences();
      items.push({ type: "card", reading, defaultOpen: cardCount === 0 });
      cardCount += 1;
    } else if (reading.reference?.trim()) {
      referenceGroup.push(reading);
    }
  }

  flushReferences();
  return items;
}

function getMemberService(id: string) {
  return memberServiceRegistry.find((service) => service.id === id) as MemberServiceDefinition | undefined;
}

function formatMassDateTime(massDate: string, startTime: string, language: string) {
  const normalizedTime = startTime.length === 5 ? `${startTime}:00` : startTime;
  return formatAppDate(`${massDate}T${normalizedTime}+03:00`, language, { dateStyle: "medium", timeStyle: "short" });
}

export default function MemberTodayPage() {
  const { t, i18n } = useTranslation();
  const { churchId } = useAuth();
  const today = useTanzaniaMemberDate();
  const reading = useQuery({ queryKey: publishedDailyReadingKey(today.dateKey), queryFn: () => fetchPublishedDailyReading(today.dateKey), staleTime: 10 * 60_000, retry: false });
  const mass = useQuery({ queryKey: dailyLifeKeys.nextTimetableMass(churchId), queryFn: () => fetchNextTimetableMass(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const saints = useQuery({ queryKey: ["daily-readings-today-saints", today.dateKey, today.month, today.day], queryFn: async () => { const { data, error } = await supabase.from("saints" as never).select(SAINT_SELECT).eq("is_active", true).eq("feast_month", today.month).eq("feast_day", today.day).order("is_featured", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as LibrarySaint[]; }, staleTime: 10 * 60_000 });
  const todayEvent = events.data?.find((event) => isEventToday(event));
  const saint = saints.data?.[0];
  const todayReadingPreviewItems = reading.data ? getTodayReadingPreviewItems(reading.data.readings) : [];
  const readingDateLabel = formatAppDate(reading.data?.date ?? today.dateKey, i18n.language, { dateStyle: "full" });

  return <main data-testid="member-today-page" className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:p-7"><p className="text-sm font-bold text-primary">{t("member_services.today.label")}</p><h1 className="mt-1 break-words text-3xl font-bold">{readingDateLabel}</h1>{reading.data?.liturgicalSeason ? <p className="mt-2 text-muted-foreground">{reading.data.liturgicalSeason}</p> : null}</section>
    <ProductionLiveMassCard />
    <section aria-labelledby="today-readings"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="today-readings" className="text-2xl font-bold">{t("member_today.readings.title")}</h2><AppLink to="/portal/daily-readings" className="text-sm font-bold text-primary">{t("member_today.readings.read_all")}</AppLink></div>{reading.isLoading ? <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-40 rounded-[26px]" /><Skeleton className="h-40 rounded-[26px]" /></div> : reading.isError || !reading.data ? <Card className="rounded-[26px] border-border/70"><CardContent className="p-5"><p className="font-semibold">{t("member_today.readings.unavailable_title")}</p><p className="mt-1 text-sm text-muted-foreground">{t("member_today.readings.unavailable_description")}</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{todayReadingPreviewItems.map((item, index) => item.type === "references" ? <DailyReadingReferenceList key={`references-${index}`} readings={item.readings} headingId={`today-reading-references-${index}`} className="lg:col-span-2" /> : <ReadingCard key={item.reading.id} reading={item.reading} reflection={item.reading.id === "gospel" && reading.data!.reflection ? reading.data!.reflection : undefined} defaultOpen={item.defaultOpen} />)}</div>}</section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saints.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : saint ? <Summary title={t("member_today.sections.saint")} to={`/portal/library/${saint.slug}`}><strong className="text-foreground">{saint.name}</strong>{saint.title ? <p>{saint.title}</p> : null}</Summary> : null}
      {mass.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : mass.data ? <Summary title={t("member_today.sections.next_mass")} to="/portal/calendar"><strong className="text-foreground">{mass.data.title}</strong><p>{formatMassDateTime(mass.data.massDate, mass.data.startTime, i18n.language)}</p></Summary> : null}
      {events.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : todayEvent ? <Summary title={t("member_today.sections.event")} to="/portal/events"><strong className="text-foreground">{todayEvent.title}</strong>{todayEvent.location ? <p>{todayEvent.location}</p> : null}</Summary> : null}
      {announcement.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : announcement.data ? <Summary title={t("member_today.sections.announcement")} to="/portal/announcements"><strong className="text-foreground">{announcement.data.title}</strong><p className="line-clamp-2">{announcementHtmlToPlainText(announcement.data.content)}</p></Summary> : null}
    </div>
    {(mass.isError || events.isError || announcement.isError || saints.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">{t("member_today.errors.partial")}</p> : null}
    <section className="grid gap-3 sm:grid-cols-3" aria-label={t("member_today.quick_actions.aria")}>{TODAY_QUICK_ACTIONS.map(({ serviceId, to, icon: Icon }) => { const service = getMemberService(serviceId); const title = service ? translateMemberServiceLabel(t, service) : serviceId; const description = service ? translateMemberServiceDescription(t, service) : ""; return <Summary key={serviceId} title={title} to={to}><Icon className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />{description}</Summary>; })}</section>
  </div></main>;
}
