import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Church, Megaphone, Sparkles } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { DailyReadingReferenceList } from "@/components/portal/daily-readings/DailyReadingPresentation";
import { ReadingCard } from "@/components/portal/daily-readings/ReadingCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";
import {
  fetchPublishedDailyReading,
  getReadableReadingDate,
  isDailyReadingSectionActionable,
  publishedDailyReadingKey,
  useTanzaniaMemberDate,
  type DailyReadingSection,
} from "@/lib/daily-readings";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextMassSummary, fetchParishEvents, isEventToday } from "@/lib/member-daily-life";

function Summary({ title, children, to }: { title: string; children: React.ReactNode; to?: string }) {
  const body = <Card className="h-full rounded-[26px] border-border/70 bg-card/85"><CardContent className="p-5"><h2 className="text-lg font-bold">{title}</h2><div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div></CardContent></Card>;
  return to ? <AppLink to={to} className="block h-full">{body}</AppLink> : body;
}

type TodayReadingPreviewItem =
  | { type: "references"; readings: DailyReadingSection[] }
  | { type: "card"; reading: DailyReadingSection; defaultOpen: boolean };

function getTodayReadingPreviewItems(readings: DailyReadingSection[]) {
  const items: TodayReadingPreviewItem[] = [];
  let referenceGroup: DailyReadingSection[] = [];
  let cardCount = 0;

  const flushReferences = () => {
    if (!referenceGroup.length) return;
    items.push({ type: "references", readings: referenceGroup });
    referenceGroup = [];
  };

  for (const reading of readings.filter((item) => item.id !== "second")) {
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

export default function MemberTodayPage() {
  const { churchId } = useAuth();
  const today = useTanzaniaMemberDate();
  const reading = useQuery({ queryKey: publishedDailyReadingKey(today.dateKey), queryFn: () => fetchPublishedDailyReading(today.dateKey), staleTime: 10 * 60_000, retry: false });
  const mass = useQuery({ queryKey: dailyLifeKeys.nextMass(churchId), queryFn: () => fetchNextMassSummary(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const saints = useQuery({ queryKey: ["daily-readings-today-saints", today.dateKey, today.month, today.day], queryFn: async () => { const { data, error } = await supabase.from("saints" as never).select(SAINT_SELECT).eq("is_active", true).eq("feast_month", today.month).eq("feast_day", today.day).order("is_featured", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as LibrarySaint[]; }, staleTime: 10 * 60_000 });
  const todayEvent = events.data?.find((event) => isEventToday(event));
  const saint = saints.data?.[0];
  const todayReadingPreviewItems = reading.data ? getTodayReadingPreviewItems(reading.data.readings) : [];

  return <main data-testid="member-today-page" className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:p-7"><p className="text-sm font-bold text-primary">Leo</p><h1 className="mt-1 break-words text-3xl font-bold">{reading.data ? getReadableReadingDate(reading.data) : new Intl.DateTimeFormat("sw-TZ", { dateStyle: "full", timeZone: "Africa/Dar_es_Salaam" }).format(new Date(`${today.dateKey}T12:00:00Z`))}</h1>{reading.data?.liturgicalSeason ? <p className="mt-2 text-muted-foreground">{reading.data.liturgicalSeason}</p> : null}</section>
    <ProductionLiveMassCard />
    <section aria-labelledby="today-readings"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="today-readings" className="text-2xl font-bold">Masomo ya leo</h2><AppLink to="/portal/daily-readings" className="text-sm font-bold text-primary">Soma yote</AppLink></div>{reading.isLoading ? <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-40 rounded-[26px]" /><Skeleton className="h-40 rounded-[26px]" /></div> : reading.isError || !reading.data ? <Card className="rounded-[26px] border-border/70"><CardContent className="p-5"><p className="font-semibold">Masomo ya leo hayajapatikana</p><p className="mt-1 text-sm text-muted-foreground">Masomo yaliyochapishwa hayapatikani kwa sasa.</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{todayReadingPreviewItems.map((item, index) => item.type === "references" ? <DailyReadingReferenceList key={`references-${index}`} readings={item.readings} headingId={`today-reading-references-${index}`} className="lg:col-span-2" /> : <ReadingCard key={item.reading.id} reading={item.reading} reflection={item.reading.id === "gospel" && reading.data!.reflection ? reading.data!.reflection : undefined} defaultOpen={item.defaultOpen} />)}</div>}</section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saints.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : saint ? <Summary title="Mtakatifu wa leo" to={`/portal/library/${saint.slug}`}><strong className="text-foreground">{saint.name}</strong>{saint.title ? <p>{saint.title}</p> : null}</Summary> : null}
      {mass.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : mass.data?.mass ? <Summary title="Misa ijayo" to="/portal/calendar"><strong className="text-foreground">{mass.data.mass.title}</strong><p>{new Date(`${mass.data.mass.massDate}T${mass.data.mass.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}</p></Summary> : null}
      {events.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : todayEvent ? <Summary title="Tukio la leo" to="/portal/events"><strong className="text-foreground">{todayEvent.title}</strong>{todayEvent.location ? <p>{todayEvent.location}</p> : null}</Summary> : null}
      {announcement.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : announcement.data ? <Summary title="Tangazo la karibuni" to="/portal/announcements"><strong className="text-foreground">{announcement.data.title}</strong><p className="line-clamp-2">{announcement.data.content}</p></Summary> : null}
    </div>
    {(mass.isError || events.isError || announcement.isError || saints.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Baadhi ya taarifa hazikupatikana. Taarifa nyingine bado zinaweza kutumika.</p> : null}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Njia za haraka"><Summary title="Biblia" to="/portal/bible"><BookOpen className="mb-2 h-5 w-5 text-primary" />Soma Neno la Mungu</Summary><Summary title="Sala" to="/portal/prayers"><Sparkles className="mb-2 h-5 w-5 text-primary" />Sala zilizochapishwa</Summary><Summary title="Kalenda" to="/portal/liturgical-calendar"><CalendarDays className="mb-2 h-5 w-5 text-primary" />Kalenda ya Liturujia</Summary></section>
  </div></main>;
}
