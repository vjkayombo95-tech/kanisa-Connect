import { lazy, Suspense, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Bookmark,
  CalendarDays,
  ChevronRight,
  FileText,
  Heart,
  Headphones,
  MessageSquareText,
  Mic2,
  Palette,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { bibleReferenceToPath, parseBibleReference } from "@/lib/bible-reference-parser";
import { formatFeastDay, getSaintImageAlt } from "@/lib/catholic-library";
import { fetchMemberCmsDailyReadingByDate } from "@/lib/super-admin/daily-readings-service";
import { fetchTodayLiturgicalReadings, getTodayDateKey, getTodayLiturgicalReadingsQueryKey, type BibleBookRow, type DailyReadingRow } from "@/lib/liturgy";
import { dailyCatholicQueryOptions } from "@/lib/portal-performance";
import { fetchTodayPrayer } from "@/lib/prayers";
import { fetchSaintOfDayFromLiturgy, getSaintOfDayQueryKey } from "@/lib/saints";
import { supabase } from "@/integrations/supabase/client";
import { resolveStaticBookRouteId } from "@/hooks/useScriptureLinks";
import { loadAudioContent, loadAudioHistory, loadAudioTracks } from "@/lib/universal-audio";
import { sourceFromTrack, type UniversalAudioPlayerSource } from "@/components/audio/audio-player-types";
import type { UniversalAudioContent, UniversalAudioHistory, UniversalAudioProgress, UniversalAudioTrack } from "@/types/universal-audio";
import { cn } from "@/lib/utils";

const UniversalAudioPlayer = lazy(() => import("@/components/audio/UniversalAudioPlayer").then((module) => ({ default: module.UniversalAudioPlayer })));

type ReadingItem = {
  key: "first" | "psalm" | "second" | "gospel" | "reflection" | "prayer";
  title: string;
  reference: string | null;
  detail?: string | null;
};

type StudyPreview = {
  id: string;
  kind: "bookmark" | "note" | "favorite";
  reference: string | null;
  excerpt: string | null;
  created_at: string;
};

type ContinueReadingState = {
  key: string;
  title: string;
  path: string;
  progress: number;
  timestamp?: number | null;
  updatedAt?: string | null;
};

type AudioProgressWithContent = UniversalAudioProgress & {
  content?: UniversalAudioContent | null;
  track?: UniversalAudioTrack | null;
};

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function friendlyDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function getLiturgicalColorClass(color?: string | null) {
  const normalized = (color ?? "").toLowerCase();
  if (normalized.includes("green")) return "bg-emerald-500";
  if (normalized.includes("white")) return "bg-stone-100 ring-1 ring-stone-300";
  if (normalized.includes("red")) return "bg-red-600";
  if (normalized.includes("purple") || normalized.includes("violet")) return "bg-violet-600";
  if (normalized.includes("rose")) return "bg-rose-400";
  if (normalized.includes("gold")) return "bg-amber-400";
  return "bg-primary";
}

function readingsFromLegacy(row: DailyReadingRow | null): ReadingItem[] {
  if (!row) return [];
  return [
    { key: "first", title: "First Reading", reference: row.first_reading_reference },
    { key: "psalm", title: "Psalm", reference: row.responsorial_psalm_reference, detail: row.psalm_response },
    { key: "second", title: "Second Reading", reference: row.second_reading_reference },
    { key: "gospel", title: "Gospel", reference: row.gospel_reference, detail: row.gospel_acclamation },
    { key: "reflection", title: "Reflection", reference: null, detail: row.reflection },
    { key: "prayer", title: "Prayer", reference: null, detail: row.prayer },
  ].filter((item) => Boolean(item.reference || item.detail));
}

function readingPath(reference: string | null, books: BibleBookRow[]) {
  if (!reference) return "/portal/daily-readings";
  const parsed = parseBibleReference(reference, books);
  return parsed ? bibleReferenceToPath(parsed) : "/portal/daily-readings";
}

async function fetchUpcomingCelebrations(date: string) {
  const { data, error } = await supabase
    .from("liturgical_days" as never)
    .select("id,date,celebration,season,liturgical_color,rank")
    .gte("date" as never, addDays(date, 1) as never)
    .order("date" as never, { ascending: true })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; date: string; celebration: string; season: string; liturgical_color: string; rank: string }>;
}

async function fetchLatestAudio(churchId: string, contentType: "homily" | "prayer" | "daily_reading") {
  const [content] = await loadAudioContent({ churchId, contentType, status: "published", limit: 1 });
  if (!content) return { content: null, track: null, source: null };
  const [track] = await loadAudioTracks(content.id);
  return { content, track: track ?? null, source: track ? sourceFromTrack(track) : null };
}

async function fetchContinueListening(userId: string, churchId: string): Promise<AudioProgressWithContent | null> {
  const { data, error } = await supabase
    .from("audio_progress" as never)
    .select("*")
    .eq("user_id" as never, userId as never)
    .eq("church_id" as never, churchId as never)
    .eq("completed" as never, false as never)
    .order("last_played_at" as never, { ascending: false })
    .limit(1);
  if (error) throw error;
  const progress = ((data ?? []) as unknown as UniversalAudioProgress[])[0];
  if (!progress) return null;
  const [content, tracks] = await Promise.all([
    supabase.from("audio_content" as never).select("*").eq("id" as never, progress.content_id as never).maybeSingle(),
    loadAudioTracks(progress.content_id),
  ]);
  if (content.error) throw content.error;
  return {
    ...progress,
    content: (content.data ?? null) as unknown as UniversalAudioContent | null,
    track: tracks.find((track) => track.id === progress.track_id) ?? tracks[0] ?? null,
  };
}

async function fetchStudyPreview(userId: string): Promise<StudyPreview[]> {
  const [bookmarks, notes, favorites] = await Promise.all([
    supabase.from("content_bookmarks" as never).select("id,reference,excerpt,created_at").eq("user_id" as never, userId as never).order("created_at" as never, { ascending: false }).limit(3),
    supabase.from("content_notes" as never).select("id,reference,excerpt,body,created_at").eq("user_id" as never, userId as never).order("created_at" as never, { ascending: false }).limit(3),
    supabase.from("content_favorites" as never).select("id,reference,excerpt,created_at").eq("user_id" as never, userId as never).order("created_at" as never, { ascending: false }).limit(3),
  ]);
  if (bookmarks.error) throw bookmarks.error;
  if (notes.error) throw notes.error;
  if (favorites.error) throw favorites.error;

  return [
    ...((bookmarks.data ?? []) as Array<{ id: string; reference: string | null; excerpt: string | null; created_at: string }>).map((item) => ({ ...item, kind: "bookmark" as const })),
    ...((notes.data ?? []) as Array<{ id: string; reference: string | null; excerpt: string | null; body?: string | null; created_at: string }>).map((item) => ({
      id: item.id,
      kind: "note" as const,
      reference: item.reference,
      excerpt: item.excerpt ?? item.body ?? null,
      created_at: item.created_at,
    })),
    ...((favorites.data ?? []) as Array<{ id: string; reference: string | null; excerpt: string | null; created_at: string }>).map((item) => ({ ...item, kind: "favorite" as const })),
  ]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
}

function readContinueReading(): ContinueReadingState | null {
  if (typeof window === "undefined") return null;
  const candidates: ContinueReadingState[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? "";
    if (!key.startsWith("kanisa:bible-sync-progress:") && !key.startsWith("kanisa:bible-reading-progress:")) continue;
    const [, , , bookId, chapter] = key.split(":");
    if (key.includes("sync-progress")) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { book?: string; chapter?: number; currentVerse?: number; listeningProgress?: number; timestamp?: number; updatedAt?: string };
        const resolvedBookId = resolveStaticBookRouteId(bookId || parsed.book);
        const resolvedChapter = chapter || (parsed.chapter ? String(parsed.chapter) : "");
        if (!resolvedBookId || !resolvedChapter) continue;
        candidates.push({
          key,
          title: `${parsed.book ?? "Bible"} ${parsed.chapter ?? chapter}${parsed.currentVerse ? `:${parsed.currentVerse}` : ""}`,
          path: `/portal/bible/${resolvedBookId}/chapter/${resolvedChapter}`,
          progress: Math.round(parsed.listeningProgress ?? 0),
          timestamp: parsed.timestamp ?? null,
          updatedAt: parsed.updatedAt ?? null,
        });
      } catch {
        continue;
      }
    } else {
      const resolvedBookId = resolveStaticBookRouteId(bookId);
      if (!resolvedBookId || !chapter) continue;
      const progress = Number(window.localStorage.getItem(key));
      candidates.push({ key, title: `Bible chapter ${chapter}`, path: `/portal/bible/${resolvedBookId}/chapter/${chapter}`, progress: Number.isFinite(progress) ? Math.round(progress) : 0 });
    }
  }
  return candidates.sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")))[0] ?? null;
}

function CardShell({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <Card className={cn("rounded-lg border-border/70 bg-card/95 shadow-sm", className)} aria-label={label}>
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function CardTitle({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function TodaysLiturgicalDayCard({ day, isLoading }: { day?: { celebration: string; season: string; liturgical_color: string; rank: string; date: string } | null; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-52 rounded-lg" />;
  return (
    <CardShell className="border-primary/20" label="Today's liturgical day">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{friendlyDate(day?.date ?? getTodayDateKey())}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
            {day?.celebration || "Today in the Church"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{day?.season || "Daily prayer, readings, and parish life"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {day?.rank ? <Badge variant="secondary" className="rounded-full">{day.rank.replace(/_/g, " ")}</Badge> : null}
          <Badge variant="outline" className="gap-2 rounded-full">
            <span className={cn("h-3 w-3 rounded-full", getLiturgicalColorClass(day?.liturgical_color))} aria-hidden="true" />
            {day?.liturgical_color || "Liturgical color"}
          </Badge>
        </div>
      </div>
    </CardShell>
  );
}

export function TodaysReadingsCard({ readings, books, isLoading }: { readings: ReadingItem[]; books: BibleBookRow[]; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-72 rounded-lg" />;
  const visible = readings.filter((item) => ["first", "psalm", "second", "gospel"].includes(item.key));
  return (
    <CardShell label="Today's readings">
      <CardTitle icon={BookOpen} title="Today's Readings" action={<Button asChild variant="ghost" size="sm"><Link to="/portal/daily-readings">All</Link></Button>} />
      <div className="mt-4 space-y-3">
        {visible.map((reading) => (
          <div key={reading.key} className="rounded-lg border border-border/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{reading.title}</p>
            <p className="mt-1 font-medium">{reading.reference}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant={reading.key === "gospel" ? "default" : "outline"} className="h-8 rounded-lg">
                <Link to={readingPath(reading.reference, books)}>{reading.key === "gospel" ? "Open Gospel" : "Read"}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-8 rounded-lg">
                <Link to="/portal/daily-readings">Continue</Link>
              </Button>
            </div>
          </div>
        ))}
        {!visible.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Today's readings have not been published yet.</p> : null}
      </div>
    </CardShell>
  );
}

export function TodaysSaintCard({ saint, isLoading }: { saint?: Awaited<ReturnType<typeof fetchSaintOfDayFromLiturgy>> | null; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-72 rounded-lg" />;
  const item = saint?.saint;
  return (
    <CardShell label="Today's saint">
      <CardTitle icon={Sparkles} title="Today's Saint" action={<Button asChild variant="ghost" size="sm"><Link to="/portal/library">Saints</Link></Button>} />
      {item ? (
        <div className="mt-4 flex gap-4">
          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {item.image_url ? <img src={item.image_url} alt={getSaintImageAlt(item)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Star className="h-7 w-7 text-muted-foreground" /></div>}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{formatFeastDay(item.feast_month, item.feast_day) ?? saint?.liturgicalDay?.celebration}</p>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.biography_short}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="h-8 rounded-lg"><Link to={`/portal/library/${item.slug || item.id}`}>Read</Link></Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled>Listen</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg" disabled>Bookmark</Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Saint of the day will appear when a matching record is published.</p>
      )}
    </CardShell>
  );
}

export function PrayerOfTheDayCard({ prayer, audio, isLoading, userId, churchId }: { prayer?: { id: string; title: string; text: string } | null; audio?: { content: UniversalAudioContent | null; source: UniversalAudioPlayerSource | null } | null; isLoading?: boolean; userId?: string | null; churchId?: string | null }) {
  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  return (
    <CardShell label="Prayer of the day">
      <CardTitle icon={Heart} title="Prayer of the Day" />
      <h3 className="mt-4 font-semibold">{prayer?.title ?? "Morning Offering"}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{prayer?.text}</p>
      <div className="mt-4 space-y-3">
        {audio?.source ? (
          <Suspense fallback={<Skeleton className="h-16 rounded-lg" />}>
            <UniversalAudioPlayer
              source={audio.source}
              variant="mini"
              persistence={userId && churchId && audio.content ? { userId, churchId, contentId: audio.content.id, trackId: audio.source.id ?? null } : null}
            />
          </Suspense>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8 rounded-lg"><Link to={`/portal/prayers/${prayer?.id ?? "morning-offering"}`}>Read</Link></Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={!audio?.source}><Play className="mr-1 h-3.5 w-3.5" />Play</Button>
        </div>
      </div>
    </CardShell>
  );
}

function PrayerLibraryCard() {
  return (
    <CardShell label="Maktaba ya Sala">
      <CardTitle icon={Heart} title="Maktaba ya Sala" />
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Soma na uhifadhi sala za Kikatoliki zilizohakikiwa, kutoka sala za kila siku hadi Rozari na Njia ya Msalaba.</p>
      <Button asChild className="mt-4 h-9 rounded-lg"><Link to="/portal/prayers">Fungua maktaba</Link></Button>
    </CardShell>
  );
}

export function TodaysHomilyCard({ audio, userId, churchId }: { audio?: { content: UniversalAudioContent | null; source: UniversalAudioPlayerSource | null } | null; userId?: string | null; churchId?: string | null }) {
  if (!audio?.content) return null;
  return (
    <CardShell label="Today's homily">
      <CardTitle icon={Mic2} title="Today's Homily" action={<Button asChild variant="ghost" size="sm"><Link to="/portal/sermons">All</Link></Button>} />
      <h3 className="mt-4 font-semibold">{audio.content.title}</h3>
      {audio.content.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{audio.content.subtitle}</p> : null}
      {audio.source ? (
        <div className="mt-4">
          <Suspense fallback={<Skeleton className="h-16 rounded-lg" />}>
            <UniversalAudioPlayer
              source={audio.source}
              variant="mini"
              persistence={userId && churchId ? { userId, churchId, contentId: audio.content.id, trackId: audio.source.id ?? null } : null}
            />
          </Suspense>
        </div>
      ) : null}
      <Button asChild variant="outline" size="sm" className="mt-4 h-8 rounded-lg"><Link to="/portal/sermons">Read transcript</Link></Button>
    </CardShell>
  );
}

export function ContinueReadingCard({ state }: { state: ContinueReadingState | null }) {
  return (
    <CardShell label="Continue reading">
      <CardTitle icon={BookOpen} title="Continue Reading" />
      {state ? (
        <div className="mt-4">
          <p className="font-semibold">{state.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{state.progress}% complete</p>
          <Button asChild className="mt-4 h-9 rounded-lg"><Link to={state.path}>Resume</Link></Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Open the Bible Reader to start a reading journey.</p>
      )}
    </CardShell>
  );
}

export function ContinueListeningCard({ progress, userId, churchId }: { progress?: AudioProgressWithContent | null; userId?: string | null; churchId?: string | null }) {
  const source = progress?.track ? sourceFromTrack(progress.track) : null;
  return (
    <CardShell label="Continue listening">
      <CardTitle icon={Headphones} title="Continue Listening" />
      {progress?.content ? (
        <div className="mt-4 space-y-3">
          <p className="font-semibold">{progress.content.title}</p>
          <p className="text-sm text-muted-foreground">{Math.round(progress.position_seconds)}s saved</p>
          {source ? (
            <Suspense fallback={<Skeleton className="h-16 rounded-lg" />}>
              <UniversalAudioPlayer source={source} variant="mini" persistence={userId && churchId ? { userId, churchId, contentId: progress.content_id, trackId: progress.track_id } : null} />
            </Suspense>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Your listening progress will appear here.</p>
      )}
    </CardShell>
  );
}

export function UpcomingCelebrationsCard({ celebrations }: { celebrations: Array<{ id: string; date: string; celebration: string; liturgical_color: string; rank: string }> }) {
  return (
    <CardShell label="Upcoming celebrations">
      <CardTitle icon={CalendarDays} title="Upcoming Celebrations" action={<Button asChild variant="ghost" size="sm"><Link to="/portal/liturgical-calendar">Calendar</Link></Button>} />
      <div className="mt-4 space-y-2">
        {celebrations.slice(0, 4).map((item) => (
          <Link key={item.id} to="/portal/liturgical-calendar" className="flex items-center justify-between gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            <span>
              <span className="block text-sm font-medium">{item.celebration}</span>
              <span className="text-xs text-muted-foreground">{friendlyDate(item.date)} · {item.rank.replace(/_/g, " ")}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
        {!celebrations.length ? <p className="text-sm text-muted-foreground">Upcoming feasts will appear here.</p> : null}
      </div>
    </CardShell>
  );
}

function PersonalizationCard({ items }: { items: StudyPreview[] }) {
  const iconByKind = { bookmark: Bookmark, note: MessageSquareText, favorite: Star };
  return (
    <CardShell label="Personal study">
      <CardTitle icon={FileText} title="Continue Study" />
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const Icon = iconByKind[item.kind];
          return (
            <div key={`${item.kind}-${item.id}`} className="flex gap-2 rounded-lg border border-border/70 p-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.reference ?? item.kind}</span>
                {item.excerpt ? <span className="line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</span> : null}
              </span>
            </div>
          );
        })}
        {!items.length ? <p className="text-sm text-muted-foreground">Bookmarks, notes, favorite prayers, and favorite verses will appear here.</p> : null}
      </div>
    </CardShell>
  );
}

export default function LiturgyHomePage() {
  const { churchId, user } = useAuth();
  const queryClient = useQueryClient();
  const today = useMemo(() => getTodayDateKey(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const [continueReading] = useMemo(() => [readContinueReading()], []);

  const liturgy = useQuery({
    queryKey: getTodayLiturgicalReadingsQueryKey(today),
    queryFn: () => fetchTodayLiturgicalReadings(today),
    ...dailyCatholicQueryOptions,
  });
  const cmsReading = useQuery({
    queryKey: ["member-cms-daily-reading", today, "daily-companion"],
    queryFn: () => fetchMemberCmsDailyReadingByDate(today),
    ...dailyCatholicQueryOptions,
  });
  const saint = useQuery({ queryKey: getSaintOfDayQueryKey(today), queryFn: () => fetchSaintOfDayFromLiturgy(today), ...dailyCatholicQueryOptions });
  const prayer = useQuery({ queryKey: ["today-prayer", today, "daily-companion"], queryFn: () => fetchTodayPrayer(today), ...dailyCatholicQueryOptions });
  const prayerAudio = useQuery({ queryKey: ["liturgy-home-audio", churchId, "prayer"], queryFn: () => fetchLatestAudio(churchId!, "prayer"), enabled: !!churchId, staleTime: 60_000 });
  const homilyAudio = useQuery({ queryKey: ["liturgy-home-audio", churchId, "homily"], queryFn: () => fetchLatestAudio(churchId!, "homily"), enabled: !!churchId, staleTime: 60_000 });
  const listening = useQuery({ queryKey: ["liturgy-home-continue-listening", user?.id, churchId], queryFn: () => fetchContinueListening(user!.id, churchId!), enabled: !!user?.id && !!churchId, staleTime: 30_000 });
  const study = useQuery({ queryKey: ["liturgy-home-study-preview", user?.id], queryFn: () => fetchStudyPreview(user!.id), enabled: !!user?.id, staleTime: 30_000 });
  const upcoming = useQuery({ queryKey: ["liturgy-home-upcoming", today], queryFn: () => fetchUpcomingCelebrations(today), ...dailyCatholicQueryOptions });

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: getTodayLiturgicalReadingsQueryKey(tomorrow),
      queryFn: () => fetchTodayLiturgicalReadings(tomorrow),
      ...dailyCatholicQueryOptions,
    });
  }, [queryClient, tomorrow]);

  const legacyReading = liturgy.data?.day?.daily_readings?.[0] ?? null;
  const readings = cmsReading.data
    ? [
        { key: "first" as const, title: "First Reading", reference: cmsReading.data.first_reading_reference },
        { key: "psalm" as const, title: "Psalm", reference: cmsReading.data.responsorial_psalm_reference },
        { key: "second" as const, title: "Second Reading", reference: cmsReading.data.second_reading_reference },
        { key: "gospel" as const, title: "Gospel", reference: cmsReading.data.gospel_reference },
        { key: "reflection" as const, title: "Reflection", reference: null, detail: cmsReading.data.reflection },
        { key: "prayer" as const, title: "Prayer", reference: null, detail: cmsReading.data.prayer },
      ].filter((item) => Boolean(item.reference || item.detail))
    : readingsFromLegacy(legacyReading);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.32))] px-3 py-4 pb-28 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <TodaysLiturgicalDayCard day={liturgy.data?.day ?? null} isLoading={liturgy.isLoading} />
        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
          <TodaysReadingsCard readings={readings} books={liturgy.data?.books ?? []} isLoading={liturgy.isLoading || cmsReading.isLoading} />
          <div className="space-y-4">
            <ContinueReadingCard state={continueReading} />
            <ContinueListeningCard progress={listening.data ?? null} userId={user?.id} churchId={churchId} />
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TodaysSaintCard saint={saint.data ?? null} isLoading={saint.isLoading} />
          <PrayerOfTheDayCard prayer={prayer.data ?? null} audio={prayerAudio.data ?? null} isLoading={prayer.isLoading || prayerAudio.isLoading} userId={user?.id} churchId={churchId} />
          <PrayerLibraryCard />
          <TodaysHomilyCard audio={homilyAudio.data ?? null} userId={user?.id} churchId={churchId} />
          <UpcomingCelebrationsCard celebrations={upcoming.data ?? []} />
          <PersonalizationCard items={study.data ?? []} />
        </section>
      </div>
    </main>
  );
}
