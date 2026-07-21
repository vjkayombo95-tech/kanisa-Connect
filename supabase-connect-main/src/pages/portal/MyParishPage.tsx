import { useMemo, type ElementType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Church,
  Clock3,
  HandCoins,
  HeartHandshake,
  MapPin,
  Megaphone,
  Navigation,
  Phone,
  PlayCircle,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { emptyParishCalendarFilters, formatCalendarDate, formatCalendarTime, addDays, startOfDay, endOfDay } from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMember } from "@/hooks/useMember";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import { resolveStaticBookRouteId } from "@/hooks/useScriptureLinks";
import { supabase } from "@/integrations/supabase/client";
import { fetchMinistrySummaries, getMyMinistriesQueryKey, type MinistrySummary } from "@/lib/ministries";
import { bibleReferenceToPath, parseBibleReference } from "@/lib/bible-reference-parser";
import { fetchMemberCmsDailyReadingByDate } from "@/lib/super-admin/daily-readings-service";
import { fetchTodayLiturgicalReadings, getTodayDateKey, getTodayLiturgicalReadingsQueryKey, type BibleBookRow } from "@/lib/liturgy";
import { fetchTodayPrayer } from "@/lib/prayers";
import { fetchPortalAnnouncements, type PortalAnnouncementRecord } from "@/lib/portal-announcements";
import { loadAudioTracks } from "@/lib/universal-audio";
import { cn } from "@/lib/utils";
import type { UniversalAudioContent, UniversalAudioProgress, UniversalAudioTrack } from "@/types/universal-audio";

type ContinueReadingState = {
  title: string;
  path: string;
  progress: number;
  updatedAt?: string | null;
};

type AudioProgressWithContent = UniversalAudioProgress & {
  content?: UniversalAudioContent | null;
  track?: UniversalAudioTrack | null;
};

type ChurchContact = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  location?: string | null;
};

type SermonRecord = {
  id: string;
  title: string | null;
  preacher: string | null;
  date: string | null;
  video_url: string | null;
  audio_url: string | null;
  content: string | null;
};

function isToday(date: string | null | undefined) {
  if (!date) return false;
  return new Date(date).toDateString() === new Date().toDateString();
}

function eventMeta(event: ParishCalendarEvent, key: string) {
  const metadata = event.metadata as Record<string, unknown> | null | undefined;
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getGospelPath(reference: string | null, books: BibleBookRow[]) {
  if (!reference) return "/portal/daily-readings";
  const parsed = parseBibleReference(reference, books);
  return parsed ? bibleReferenceToPath(parsed) : "/portal/daily-readings";
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
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
          book?: string;
          chapter?: number;
          currentVerse?: number;
          listeningProgress?: number;
          updatedAt?: string;
        };
        const resolvedBookId = resolveStaticBookRouteId(bookId || parsed.book);
        const resolvedChapter = chapter || (parsed.chapter ? String(parsed.chapter) : "");
        if (!resolvedBookId || !resolvedChapter) continue;
        candidates.push({
          title: `${parsed.book ?? "Bible"} ${parsed.chapter ?? chapter}${parsed.currentVerse ? `:${parsed.currentVerse}` : ""}`,
          path: `/portal/bible/${resolvedBookId}/chapter/${resolvedChapter}`,
          progress: Math.round(parsed.listeningProgress ?? 0),
          updatedAt: parsed.updatedAt ?? null,
        });
      } catch {
        continue;
      }
    } else {
      const resolvedBookId = resolveStaticBookRouteId(bookId);
      if (!resolvedBookId || !chapter) continue;
      const progress = Number(window.localStorage.getItem(key));
      candidates.push({ title: `Bible chapter ${chapter}`, path: `/portal/bible/${resolvedBookId}/chapter/${chapter}`, progress: Number.isFinite(progress) ? Math.round(progress) : 0 });
    }
  }

  return candidates.sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")))[0] ?? null;
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

async function fetchChurchContact(churchId: string): Promise<ChurchContact | null> {
  const { data, error } = await supabase.from("churches").select("*").eq("id", churchId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ChurchContact | null;
}

async function fetchLiveMassItems(churchId: string): Promise<SermonRecord[]> {
  const { data, error } = await supabase
    .from("sermons")
    .select("id,title,preacher,date,video_url,audio_url,content")
    .eq("church_id", churchId)
    .is("archived_at", null)
    .order("date", { ascending: false })
    .limit(3);

  if (error) throw error;
  return (data ?? []) as SermonRecord[];
}

async function fetchRecentMassIntentions(churchId: string) {
  const { data, error } = await supabase
    .from("mass_intentions")
    .select("id,intention_type,message,status,requested_mass_date,created_at")
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; intention_type: string; message: string; status: string; requested_mass_date: string | null; created_at: string }>;
}

function SectionCard({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <Card className={cn("rounded-lg border-border/70 bg-card/95 shadow-sm", className)} aria-label={label}>
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function WidgetTitle({ icon: Icon, title, action }: { icon: ElementType; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="truncate text-base font-semibold tracking-normal">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EventRow({ event, actionLabel, actionTo }: { event: ParishCalendarEvent; actionLabel?: string; actionTo?: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{event.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCalendarDate(event.startsAt)} at {formatCalendarTime(event.startsAt)}
          </p>
          {event.location ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {event.location}
            </p>
          ) : null}
        </div>
        {actionLabel && actionTo ? (
          <Button asChild size="sm" variant="ghost" className="h-8 shrink-0 rounded-lg">
            <AppLink to={actionTo}>{actionLabel}</AppLink>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TodaysMassWidget({ masses }: { masses: ParishCalendarEvent[] }) {
  const nextMass = masses.find((event) => new Date(event.startsAt).getTime() >= Date.now()) ?? masses[0] ?? null;
  const minutesUntil = nextMass ? Math.max(0, Math.round((new Date(nextMass.startsAt).getTime() - Date.now()) / 60000)) : null;

  return (
    <SectionCard className="border-primary/20" label="Today's Mass">
      <WidgetTitle icon={Church} title="Today's Mass" action={<Badge variant="secondary">{masses.length} today</Badge>} />
      {nextMass ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-2xl font-bold tracking-normal">{formatCalendarTime(nextMass.startsAt)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {minutesUntil === 0 ? "Happening now" : `Next Mass in ${minutesUntil} min`}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Location:</span> {nextMass.location || "Main church"}</p>
            <p><span className="text-muted-foreground">Celebrant:</span> {eventMeta(nextMass, "celebrant") ?? "Parish clergy"}</p>
            <p><span className="text-muted-foreground">Language:</span> {eventMeta(nextMass, "language") ?? "Local language"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="h-9 rounded-lg"><AppLink to="/portal/calendar"><Clock3 className="mr-1.5 h-4 w-4" />Add reminder</AppLink></Button>
            <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><AppLink to="/portal/calendar"><Navigation className="mr-1.5 h-4 w-4" />Navigate</AppLink></Button>
            <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><AppLink to="/portal/sermons"><Radio className="mr-1.5 h-4 w-4" />Livestream</AppLink></Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Today's Mass schedule will appear here when published.</p>
      )}
    </SectionCard>
  );
}

export function MassScheduleWidget({ masses }: { masses: ParishCalendarEvent[] }) {
  return (
    <SectionCard label="Mass schedule">
      <WidgetTitle icon={CalendarDays} title="Mass Schedule" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/calendar">Calendar</AppLink></Button>} />
      <div className="mt-4 space-y-2">
        {masses.slice(0, 4).map((event) => <EventRow key={event.id} event={event} />)}
        {!masses.length ? <p className="text-sm text-muted-foreground">Upcoming Masses will appear here.</p> : null}
      </div>
    </SectionCard>
  );
}

export function ConfessionTimesWidget({ confessions }: { confessions: ParishCalendarEvent[] }) {
  return (
    <SectionCard label="Confession times">
      <WidgetTitle icon={HeartHandshake} title="Confession Times" />
      <div className="mt-4 space-y-2">
        {confessions.slice(0, 4).map((event) => <EventRow key={event.id} event={event} />)}
        {!confessions.length ? <p className="text-sm text-muted-foreground">Confession times have not been published yet.</p> : null}
      </div>
    </SectionCard>
  );
}

export function ParishAnnouncementsWidget({ announcements, isLoading }: { announcements: PortalAnnouncementRecord[]; isLoading?: boolean }) {
  if (isLoading) return <Skeleton className="h-64 rounded-lg" />;
  const pinned = announcements.filter((item) => item.featured || item.status === "pinned").slice(0, 2);
  const visible = (pinned.length ? pinned : announcements).slice(0, 4);

  return (
    <SectionCard label="Parish announcements">
      <WidgetTitle icon={Megaphone} title="Announcements" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/announcements">All</AppLink></Button>} />
      <div className="mt-4 space-y-3">
        {visible.map((item) => (
          <AppLink key={item.id} to="/portal/announcements" className="block rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
              {item.featured || item.status === "pinned" ? <Badge variant="secondary">Pinned</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.content}</p>
          </AppLink>
        ))}
        {!visible.length ? <p className="text-sm text-muted-foreground">Recent notices from your parish will appear here.</p> : null}
      </div>
    </SectionCard>
  );
}

export function UpcomingEventsWidget({ events }: { events: ParishCalendarEvent[] }) {
  return (
    <SectionCard label="Upcoming events">
      <WidgetTitle icon={CalendarDays} title="Upcoming Events" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/events">RSVP</AppLink></Button>} />
      <div className="mt-4 space-y-2">
        {events.slice(0, 5).map((event) => <EventRow key={event.id} event={event} actionLabel="Open" actionTo="/portal/events" />)}
        {!events.length ? <p className="text-sm text-muted-foreground">Parish events will appear here.</p> : null}
      </div>
    </SectionCard>
  );
}

export function VolunteerOpportunitiesWidget({ ministries, events }: { ministries: MinistrySummary[]; events: ParishCalendarEvent[] }) {
  const openMinistries = ministries.filter((ministry) => !ministry.isMember).slice(0, 3);
  const training = events.filter((event) => event.type === "training" || event.type === "ministry_meeting").slice(0, 2);

  return (
    <SectionCard label="Volunteer opportunities">
      <WidgetTitle icon={Users} title="Volunteer" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/ministries">Join</AppLink></Button>} />
      <div className="mt-4 space-y-3">
        {openMinistries.map((ministry) => (
          <AppLink key={ministry.id} to={`/portal/ministries/${ministry.id}`} className="block rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            <p className="text-sm font-semibold">{ministry.name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ministry.description || "Open for parishioners to serve."}</p>
          </AppLink>
        ))}
        {training.map((event) => <EventRow key={event.id} event={event} />)}
        {!openMinistries.length && !training.length ? <p className="text-sm text-muted-foreground">Ministries needing volunteers will appear here.</p> : null}
      </div>
    </SectionCard>
  );
}

export function MassIntentionsWidget({ intentions }: { intentions: Awaited<ReturnType<typeof fetchRecentMassIntentions>> }) {
  return (
    <SectionCard label="Mass intentions">
      <WidgetTitle icon={Sparkles} title="Mass Intentions" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/mass-intentions">Request</AppLink></Button>} />
      <div className="mt-4 space-y-2">
        {intentions.map((item) => (
          <div key={item.id} className="rounded-lg border border-border/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold capitalize">{item.intention_type.replace(/_/g, " ")}</p>
              <Badge variant="outline">{item.status}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
          </div>
        ))}
        {!intentions.length ? <p className="text-sm text-muted-foreground">Submit Mass intentions for prayer at Mass.</p> : null}
      </div>
    </SectionCard>
  );
}

export function LiveStreamWidget({ sermons }: { sermons: SermonRecord[] }) {
  const live = sermons.find((item) => item.video_url || item.audio_url) ?? null;

  return (
    <SectionCard label="Live Mass">
      <WidgetTitle icon={Radio} title="Live Mass" action={<Button asChild variant="ghost" size="sm"><AppLink to="/portal/sermons">Archive</AppLink></Button>} />
      {live ? (
        <div className="mt-4 space-y-3">
          <p className="font-semibold">{live.title}</p>
          <p className="text-sm text-muted-foreground">{live.preacher || "Parish livestream and homily archive"}</p>
          <div className="flex flex-wrap gap-2">
            {live.video_url ? (
              <Button asChild size="sm" className="h-9 rounded-lg"><a href={live.video_url} target="_blank" rel="noreferrer"><PlayCircle className="mr-1.5 h-4 w-4" />Watch</a></Button>
            ) : null}
            {live.audio_url ? (
              <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><a href={live.audio_url} target="_blank" rel="noreferrer">Listen</a></Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Current livestream, upcoming livestreams, and Mass archives will appear here.</p>
      )}
    </SectionCard>
  );
}

export function ContactParishWidget({ contact }: { contact: ChurchContact | null }) {
  return (
    <SectionCard label="Contact parish">
      <WidgetTitle icon={Phone} title="Contact Parish" />
      <div className="mt-4 space-y-2 text-sm">
        <p className="font-semibold">{contact?.name || "Your parish"}</p>
        <p className="text-muted-foreground">{contact?.address || contact?.location || "Parish office contact details will appear here."}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {contact?.phone ? <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><a href={`tel:${contact.phone}`}>Call</a></Button> : null}
          {contact?.email ? <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><a href={`mailto:${contact.email}`}>Email</a></Button> : null}
        </div>
      </div>
    </SectionCard>
  );
}

export function QuickGiveWidget() {
  return (
    <SectionCard label="Quick Give">
      <WidgetTitle icon={HandCoins} title="Quick Give" />
      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">Give, set recurring support through pledges, or support parish campaigns from the Contributions module.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-9 rounded-lg"><AppLink to="/portal/give">Quick Give</AppLink></Button>
          <Button asChild size="sm" variant="outline" className="h-9 rounded-lg"><AppLink to="/portal/pledges">Recurring Giving</AppLink></Button>
          <Button asChild size="sm" variant="ghost" className="h-9 rounded-lg"><AppLink to="/portal/contribution-history">History</AppLink></Button>
        </div>
      </div>
    </SectionCard>
  );
}

export function EmergencyPrayerRequestsWidget() {
  return (
    <SectionCard label="Emergency prayer requests">
      <WidgetTitle icon={HeartHandshake} title="Emergency Prayer" />
      <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">Send an urgent request to your parish prayer team and pastoral care workflow.</p>
        <Button asChild size="sm" className="h-9 rounded-lg"><AppLink to="/portal/prayer-requests">Request Prayer</AppLink></Button>
      </div>
    </SectionCard>
  );
}

export function ParishNotificationsWidget({ nextMass, nextEvent }: { nextMass: ParishCalendarEvent | null; nextEvent: ParishCalendarEvent | null }) {
  return (
    <SectionCard label="Notifications">
      <WidgetTitle icon={Bell} title="Notifications" />
      <div className="mt-4 space-y-2 text-sm">
        <p>Upcoming Mass{nextMass ? `: ${formatCalendarTime(nextMass.startsAt)}` : " reminders will appear here."}</p>
        <p>Today's Gospel is ready in Daily Readings.</p>
        <p>{nextEvent ? `Next event: ${nextEvent.title}` : "Event reminders will appear when events are published."}</p>
      </div>
    </SectionCard>
  );
}

export function ParishSpiritualBridgeWidget({
  gospelReference,
  gospelPath,
  prayerTitle,
  continueReading,
  continueListening,
}: {
  gospelReference: string | null;
  gospelPath: string;
  prayerTitle: string | null;
  continueReading: ContinueReadingState | null;
  continueListening: AudioProgressWithContent | null;
}) {
  return (
    <SectionCard className="border-primary/20" label="Catholic companion">
      <WidgetTitle icon={BookOpen} title="Today With Your Parish" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AppLink to={gospelPath} className="rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Today's Gospel</p>
          <p className="mt-1 font-medium">{gospelReference || "Open Daily Readings"}</p>
        </AppLink>
        <AppLink to="/portal/daily-readings" className="rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Prayer of the Day</p>
          <p className="mt-1 font-medium">{prayerTitle || "Daily prayer"}</p>
        </AppLink>
        <AppLink to={continueReading?.path ?? "/portal/bible"} className="rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Continue Reading</p>
          <p className="mt-1 font-medium">{continueReading ? `${continueReading.title} (${continueReading.progress}%)` : "Open Bible Reader"}</p>
        </AppLink>
        <AppLink to="/portal/sermons" className="rounded-lg border border-border/70 p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Continue Listening</p>
          <p className="mt-1 font-medium">{continueListening?.content?.title || "Open audio library"}</p>
        </AppLink>
      </div>
    </SectionCard>
  );
}

export default function MyParishPage() {
  const { churchId, user } = useAuth();
  const { data: member } = useMember("id, full_name, church_id");
  const today = useMemo(() => getTodayDateKey(), []);
  const calendarRange = useMemo(() => ({ from: startOfDay(new Date()), to: endOfDay(addDays(new Date(), 21)) }), []);
  const continueReading = useMemo(() => readContinueReading(), []);

  const calendar = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
    range: calendarRange,
    enabled: !!churchId,
  });
  const liturgy = useQuery({ queryKey: getTodayLiturgicalReadingsQueryKey(today), queryFn: () => fetchTodayLiturgicalReadings(today), staleTime: 60_000 });
  const cmsReading = useQuery({ queryKey: ["member-cms-daily-reading", today, "my-parish"], queryFn: () => fetchMemberCmsDailyReadingByDate(today), staleTime: 60_000 });
  const prayer = useQuery({ queryKey: ["today-prayer", today, "my-parish"], queryFn: () => fetchTodayPrayer(today), staleTime: 60_000 });
  const announcements = useQuery({ queryKey: ["my-parish-announcements", churchId], queryFn: () => fetchPortalAnnouncements(churchId, 6), enabled: !!churchId, staleTime: 60_000 });
  const ministries = useQuery({
    queryKey: getMyMinistriesQueryKey(member?.id, churchId),
    queryFn: () => fetchMinistrySummaries({ churchId, memberId: member?.id }),
    enabled: !!churchId,
    staleTime: 2 * 60_000,
  });
  const intentions = useQuery({ queryKey: ["my-parish-mass-intentions", churchId], queryFn: () => fetchRecentMassIntentions(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const sermons = useQuery({ queryKey: ["my-parish-live-mass", churchId], queryFn: () => fetchLiveMassItems(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const contact = useQuery({ queryKey: ["my-parish-contact", churchId], queryFn: () => fetchChurchContact(churchId!), enabled: !!churchId, staleTime: 10 * 60_000 });
  const listening = useQuery({
    queryKey: ["my-parish-continue-listening", user?.id, churchId],
    queryFn: () => fetchContinueListening(user!.id, churchId!),
    enabled: !!user?.id && !!churchId,
    staleTime: 30_000,
  });

  const masses = useMemo(() => calendar.events.filter((event) => event.type === "mass" || event.category === "mass"), [calendar.events]);
  const todaysMasses = useMemo(() => masses.filter((event) => isToday(event.startsAt)), [masses]);
  const confessions = useMemo(() => calendar.events.filter((event) => event.type === "confession"), [calendar.events]);
  const upcomingEvents = useMemo(
    () => calendar.events.filter((event) => !["mass", "confession", "mass_intention", "daily_reading", "liturgical"].includes(event.type)).filter((event) => new Date(event.startsAt).getTime() >= Date.now()),
    [calendar.events],
  );
  const nextMass = masses.find((event) => new Date(event.startsAt).getTime() >= Date.now()) ?? null;
  const nextEvent = upcomingEvents[0] ?? null;
  const legacyReading = liturgy.data?.day?.daily_readings?.[0] ?? null;
  const gospelReference = cmsReading.data?.gospel_reference ?? legacyReading?.gospel_reference ?? null;
  const gospelPath = getGospelPath(gospelReference, liturgy.data?.books ?? []);

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.32))] px-3 py-4 pb-28 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-lg border border-primary/20 bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Church className="h-4 w-4" aria-hidden="true" />
                My Parish
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">Faith and parish life in one place</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Open today with the Gospel, Mass, prayer, announcements, events, giving, livestreams, and your saved reading and listening progress.</p>
            </div>
            <Button asChild className="h-10 rounded-lg lg:self-end">
              <AppLink to="/portal/calendar">Open Parish Calendar<ChevronRight className="ml-1.5 h-4 w-4" /></AppLink>
            </Button>
          </div>
        </section>

        <ParishSpiritualBridgeWidget
          gospelReference={gospelReference}
          gospelPath={gospelPath}
          prayerTitle={prayer.data?.title ?? null}
          continueReading={continueReading}
          continueListening={listening.data ?? null}
        />

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <TodaysMassWidget masses={todaysMasses.length ? todaysMasses : masses.slice(0, 1)} />
          <LiveStreamWidget sermons={sermons.data ?? []} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MassScheduleWidget masses={masses} />
          <ConfessionTimesWidget confessions={confessions} />
          <ParishAnnouncementsWidget announcements={announcements.data ?? []} isLoading={announcements.isLoading} />
          <UpcomingEventsWidget events={upcomingEvents} />
          <VolunteerOpportunitiesWidget ministries={ministries.data ?? []} events={upcomingEvents} />
          <MassIntentionsWidget intentions={intentions.data ?? []} />
          <QuickGiveWidget />
          <EmergencyPrayerRequestsWidget />
          <ParishNotificationsWidget nextMass={nextMass} nextEvent={nextEvent} />
          <ContactParishWidget contact={contact.data ?? null} />
        </section>
      </div>
    </main>
  );
}
