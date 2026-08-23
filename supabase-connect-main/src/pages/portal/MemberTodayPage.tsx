import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Church, Megaphone, Sparkles } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { ReadingCard } from "@/components/portal/daily-readings/ReadingCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";
import { getReadableReadingDate, getTodayReadingEntry } from "@/lib/daily-readings";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextMass, fetchParishEvents, isEventToday } from "@/lib/member-daily-life";

function Summary({ title, children, to }: { title: string; children: React.ReactNode; to?: string }) {
  const body = <Card className="h-full rounded-[26px] border-border/70 bg-card/85"><CardContent className="p-5"><h2 className="text-lg font-bold">{title}</h2><div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div></CardContent></Card>;
  return to ? <AppLink to={to} className="block h-full">{body}</AppLink> : body;
}

export default function MemberTodayPage() {
  const { churchId } = useAuth();
  const reading = useMemo(() => getTodayReadingEntry(), []);
  const today = useMemo(() => new Date(), []);
  const mass = useQuery({ queryKey: dailyLifeKeys.nextMass(churchId), queryFn: () => fetchNextMass(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const saints = useQuery({ queryKey: ["daily-readings-today-saints", today.getMonth() + 1, today.getDate()], queryFn: async () => { const { data, error } = await supabase.from("saints" as never).select(SAINT_SELECT).eq("is_active", true).eq("feast_month", today.getMonth() + 1).eq("feast_day", today.getDate()).order("is_featured", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as LibrarySaint[]; }, staleTime: 10 * 60_000 });
  const todayEvent = events.data?.find((event) => isEventToday(event));
  const saint = saints.data?.[0];

  return <main data-testid="member-today-page" className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:p-7"><p className="text-sm font-bold text-primary">Leo</p><h1 className="mt-1 break-words text-3xl font-bold">{getReadableReadingDate(reading)}</h1><p className="mt-2 text-muted-foreground">{reading.liturgicalSeason || "Safari ya imani ya leo"}</p></section>
    <ProductionLiveMassCard />
    <section aria-labelledby="today-readings"><h2 id="today-readings" className="mb-3 text-2xl font-bold">Masomo ya leo</h2><div className="grid gap-4 lg:grid-cols-2">{reading.readings.filter((item) => item.id !== "second").map((item, index) => <ReadingCard key={item.id} reading={item} reflection={item.id === "gospel" ? reading.reflection : undefined} defaultOpen={index === 0} />)}</div></section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saints.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : saint ? <Summary title="Mtakatifu wa leo" to={`/portal/library/${saint.slug}`}><strong className="text-foreground">{saint.name}</strong>{saint.title ? <p>{saint.title}</p> : null}</Summary> : null}
      {mass.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : mass.data ? <Summary title="Misa ijayo" to="/portal/calendar"><strong className="text-foreground">{mass.data.title}</strong><p>{new Date(`${mass.data.massDate}T${mass.data.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}</p></Summary> : null}
      {events.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : todayEvent ? <Summary title="Tukio la leo" to="/portal/events"><strong className="text-foreground">{todayEvent.title}</strong>{todayEvent.location ? <p>{todayEvent.location}</p> : null}</Summary> : null}
      {announcement.isLoading ? <Skeleton className="h-36 rounded-[26px]" /> : announcement.data ? <Summary title="Tangazo la karibuni" to="/portal/announcements"><strong className="text-foreground">{announcement.data.title}</strong><p className="line-clamp-2">{announcement.data.content}</p></Summary> : null}
    </div>
    {(mass.isError || events.isError || announcement.isError || saints.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Baadhi ya taarifa hazikupatikana. Taarifa nyingine bado zinaweza kutumika.</p> : null}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Njia za haraka"><Summary title="Biblia" to="/portal/bible"><BookOpen className="mb-2 h-5 w-5 text-primary" />Soma Neno la Mungu</Summary><Summary title="Sala" to="/portal/prayers"><Sparkles className="mb-2 h-5 w-5 text-primary" />Sala zilizochapishwa</Summary><Summary title="Kalenda" to="/portal/liturgical-calendar"><CalendarDays className="mb-2 h-5 w-5 text-primary" />Kalenda ya Liturujia</Summary></section>
  </div></main>;
}
