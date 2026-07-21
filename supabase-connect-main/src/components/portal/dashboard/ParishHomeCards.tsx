import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  Church,
  Clock,
  HeartHandshake,
  MapPin,
  Megaphone,
  Phone,
  Radio,
  Sparkles,
  Sun,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { emptyParishCalendarFilters, formatCalendarTime } from "@/components/calendar/calendarUtils";
import type { ParishCalendarEvent } from "@/components/calendar/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import { supabase } from "@/integrations/supabase/client";
import { bibleReferenceToPath, parseBibleReference } from "@/lib/bible-reference-parser";
import { formatLiturgicalDate, type BibleBookRow, type LiturgicalDayRow } from "@/lib/liturgy";
import { bibleQueryOptions } from "@/lib/portal-performance";
import { cn } from "@/lib/utils";
import { announcementHtmlToPlainText } from "@/lib/announcement-content";

import { SaintOfTheDayCard } from "./SaintOfTheDayCard";
import { TodaysPrayerCard } from "./TodaysPrayerCard";
import { TodaysReflectionCard } from "./TodaysReflectionCard";
import type { MemberHomeData, NextMassSummary } from "./types";
import { formatDate, formatMassTime, truncatePreview } from "./utils";

type HeroProps = {
  home: MemberHomeData;
  todayDate: string;
  todayLiturgy: LiturgicalDayRow | null;
};

type TodaysMassCardProps = {
  deadlinePassed: boolean;
  home: MemberHomeData;
  massSummary: NextMassSummary | undefined;
  rsvpDisabled: boolean;
  submitMassResponse: {
    isPending: boolean;
    variables?: "yes" | "maybe" | "no";
    mutate: (response: "yes" | "maybe" | "no") => void;
  };
  todayDate: string;
};

type GospelHighlightCardProps = {
  books: BibleBookRow[];
  todayLiturgy: LiturgicalDayRow | null;
};

type ParishLifeCardProps = {
  churchId: string | null | undefined;
  latestAnnouncement: MemberHomeData["latestAnnouncement"];
};

type PrayerFocusSectionProps = {
  reflectionError: boolean;
  reflectionLoading: boolean;
  saintError: boolean;
  saintFeastTitle: string;
  saintLoading: boolean;
  saintOfDay: any | null;
  prayerError: boolean;
  prayerLoading: boolean;
  todayPrayer: any | null | undefined;
  todayReflection: any | null | undefined;
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getReadingGospelReference(todayLiturgy: LiturgicalDayRow | null) {
  return todayLiturgy?.daily_readings?.[0]?.gospel_reference ?? null;
}

function getEventDateLabel(event: ParishCalendarEvent | null) {
  if (!event) return null;
  return `${formatDate(event.startsAt)} at ${formatCalendarTime(event.startsAt)}`;
}

function InfoSummary({
  icon: Icon,
  label,
  title,
  detail,
  to,
}: {
  icon: typeof CalendarDays;
  label: string;
  title: string;
  detail: string;
  to: string;
}) {
  return (
    <AppLink
      to={to}
      className="block rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase text-muted-foreground">{label}</span>
          <span className="mt-1 block truncate text-base font-bold text-foreground">{title}</span>
        </span>
      </div>
      <span className="mt-3 block line-clamp-2 text-sm leading-6 text-muted-foreground">{detail}</span>
    </AppLink>
  );
}

export function ParishHero({ home, todayDate, todayLiturgy }: HeroProps) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-primary/20 bg-card/90 shadow-sm">
      <CardContent className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-primary/20 bg-primary/10 text-primary">
              {home.churchLogoUrl ? (
                <img
                  src={home.churchLogoUrl}
                  alt={`${home.churchName ?? "Church"} logo`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Church className="h-8 w-8" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">
                {getTimeGreeting()}, {home.memberName}
              </p>
              <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Welcome to {home.churchName ?? "your parish"}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">{formatLiturgicalDate(todayDate)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-4 md:w-72">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
              Today
            </p>
            <p className="mt-2 text-lg font-bold leading-tight text-foreground">
              {todayLiturgy?.celebration ?? "Parish day"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {todayLiturgy?.season ? <Badge variant="secondary">{todayLiturgy.season}</Badge> : null}
              {todayLiturgy?.liturgical_color ? <Badge variant="outline">{todayLiturgy.liturgical_color}</Badge> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TodaysMassCard({
  deadlinePassed,
  home,
  massSummary,
  rsvpDisabled,
  submitMassResponse,
  todayDate,
}: TodaysMassCardProps) {
  const nextMass = massSummary?.mass ?? null;
  const isToday = nextMass?.mass_date === todayDate;

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <Church className="h-4 w-4" aria-hidden="true" />
              {isToday ? "Today's Mass" : "Next Scheduled Mass"}
            </p>
            {nextMass ? (
              <>
                <h2 className="mt-2 text-2xl font-bold text-foreground">{nextMass.title}</h2>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                    {formatDate(nextMass.mass_date)} at {formatMassTime(nextMass.start_time)}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    {home.churchAddress ?? home.churchName ?? "Parish church"}
                  </span>
                </div>
                {nextMass.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{nextMass.description}</p> : null}
                {home.churchLivestreamUrl ? (
                  <Button asChild variant="outline" className="mt-4 h-10 rounded-xl">
                    <a href={home.churchLivestreamUrl} target="_blank" rel="noreferrer">
                      <Radio className="mr-2 h-4 w-4" aria-hidden="true" />
                      Livestream
                    </a>
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No Mass has been scheduled yet.</p>
            )}
          </div>

          {nextMass ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/50 p-4">
              <p className="text-sm font-medium text-foreground">Will you attend?</p>
              <div className="flex flex-wrap gap-2">
                {(["yes", "maybe", "no"] as const).map((response) => (
                  <Button
                    key={response}
                    variant={nextMass.my_response === response ? "default" : "outline"}
                    className="min-w-24 capitalize"
                    disabled={rsvpDisabled}
                    onClick={() => submitMassResponse.mutate(response)}
                  >
                    {submitMassResponse.isPending && submitMassResponse.variables === response ? "Saving..." : response}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Expected: {massSummary?.yes_count ?? 0}</span>
                <span>Maybe: {massSummary?.maybe_count ?? 0}</span>
                <span>Response rate: {Number(massSummary?.response_rate ?? 0).toFixed(0)}%</span>
              </div>
              {deadlinePassed ? <p className="text-xs text-muted-foreground">RSVP deadline has passed.</p> : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function GospelHighlightCard({ books, todayLiturgy }: GospelHighlightCardProps) {
  const gospelReference = getReadingGospelReference(todayLiturgy);
  const parsedReference = useMemo(
    () => (gospelReference ? parseBibleReference(gospelReference, books) : null),
    [books, gospelReference],
  );
  const chapter = parsedReference?.kind === "chapter" || parsedReference?.kind === "verse" ? parsedReference.chapter : null;
  const openingVerse = parsedReference?.kind === "verse" ? parsedReference.startVerse : 1;
  const biblePath = parsedReference ? bibleReferenceToPath(parsedReference) : "/portal/daily-readings";

  const { data: preview, isLoading } = useQuery({
    queryKey: ["parish-home-gospel-preview", parsedReference?.book.id, chapter, openingVerse],
    queryFn: async () => {
      if (!parsedReference?.book.id || !chapter) return null;

      const { data, error } = await supabase
        .from("bible_verses" as never)
        .select("verse_text,text")
        .eq("book_id", parsedReference.book.id)
        .eq("chapter_number", chapter)
        .eq("verse_number", openingVerse)
        .maybeSingle();

      if (error) throw error;
      const verse = data as unknown as { verse_text: string | null; text: string | null } | null;
      return verse?.verse_text ?? verse?.text ?? null;
    },
    enabled: !!parsedReference?.book.id && !!chapter,
    ...bibleQueryOptions,
  });

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Today's Gospel Highlight
        </p>
        {gospelReference ? (
          <>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Gospel</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">{gospelReference}</h2>
            </div>
            {isLoading ? (
              <Skeleton className="h-16 rounded-2xl" />
            ) : preview ? (
              <p className="line-clamp-3 rounded-2xl border border-border/60 bg-background/50 p-4 text-sm leading-6 text-muted-foreground">
                {truncatePreview(preview, 220)}
              </p>
            ) : (
              <p className="rounded-2xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
                Open today's readings to continue with the Gospel.
              </p>
            )}
            <Button asChild className="h-11 rounded-2xl">
              <AppLink to={biblePath}>Read Gospel</AppLink>
            </Button>
          </>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-sm font-semibold text-foreground">No Gospel reading is linked for today.</p>
            <p className="mt-1 text-sm text-muted-foreground">Open Daily Readings for the full liturgical day.</p>
            <Button asChild variant="outline" className="mt-4 h-11 rounded-2xl">
              <AppLink to="/portal/daily-readings">Daily Readings</AppLink>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ParishLifeCard({ churchId, latestAnnouncement }: ParishLifeCardProps) {
  const { events, isLoading, isError } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
  });
  const now = Date.now();
  const upcomingEvent = useMemo(
    () =>
      events
        .filter((event) => event.type !== "mass" && new Date(event.startsAt).getTime() >= now)
        .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())[0] ?? null,
    [events, now],
  );
  const communityEvent = useMemo(
    () =>
      events
        .filter((event) => event.type === "community_help_visit" || /community|help|jumuiya/i.test(event.title))
        .filter((event) => new Date(event.startsAt).getTime() >= now)
        .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())[0] ?? null,
    [events, now],
  );

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Parish Life
            </p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">What is happening around the parish</h2>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl">
            <AppLink to="/portal/calendar">Open Calendar</AppLink>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Parish activity could not be loaded.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <InfoSummary
              icon={CalendarDays}
              label="Upcoming Event"
              title={upcomingEvent?.title ?? "No upcoming event"}
              detail={getEventDateLabel(upcomingEvent) ?? "No upcoming parish activities."}
              to="/portal/events"
            />
            <InfoSummary
              icon={HeartHandshake}
              label="Community Activity"
              title={communityEvent?.title ?? "Community care"}
              detail={getEventDateLabel(communityEvent) ?? "Community updates will appear here when scheduled."}
              to="/portal/community-help"
            />
            <InfoSummary
              icon={Megaphone}
              label="Latest Announcement"
              title={latestAnnouncement?.title ?? "No announcement"}
              detail={latestAnnouncement?.content ? truncatePreview(announcementHtmlToPlainText(latestAnnouncement.content), 120) : "No parish announcement is published right now."}
              to="/portal/announcements"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PrayerFocusSection({
  reflectionError,
  reflectionLoading,
  saintError,
  saintFeastTitle,
  saintLoading,
  saintOfDay,
  prayerError,
  prayerLoading,
  todayPrayer,
  todayReflection,
}: PrayerFocusSectionProps) {
  return (
    <section className="space-y-3" aria-labelledby="prayer-focus-heading">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="prayer-focus-heading" className="text-lg font-semibold text-foreground">
            Prayer Focus
          </h2>
          <p className="text-sm text-muted-foreground">Today's prayer, saint, and reflection for your parish journey.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <SaintOfTheDayCard
          saintOfDay={saintOfDay}
          saintFeastTitle={saintFeastTitle}
          saintLoading={saintLoading}
          saintError={saintError}
        />
        <div className="grid gap-3">
          <TodaysPrayerCard todayPrayer={todayPrayer} prayerLoading={prayerLoading} prayerError={prayerError} />
          <TodaysReflectionCard
            todayReflection={todayReflection}
            reflectionLoading={reflectionLoading}
            reflectionError={reflectionError}
          />
        </div>
      </div>
    </section>
  );
}

export function ParishFooter({ home }: { home: MemberHomeData }) {
  const contactItems = [
    { icon: MapPin, label: "Address", value: home.churchAddress },
    { icon: Phone, label: "Phone", value: home.churchPhone },
    { icon: Clock, label: "Office Hours", value: home.churchOfficeHours },
    { icon: Radio, label: "Emergency", value: home.churchEmergencyContact },
  ].filter((item) => item.value);

  return (
    <footer className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{home.churchName ?? "Parish Office"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Contact and parish office details</p>
        </div>
        {home.churchSocialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {home.churchSocialLinks.map((link) => (
              <a
                key={`${link.label}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border/70 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {contactItems.length > 0 || home.churchEmail ? (
        <div className={cn("mt-4 grid gap-3", contactItems.length > 1 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2")}>
          {contactItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {label}
              </p>
              <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
          {home.churchEmail ? (
            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Email</p>
              <p className="mt-1 break-words text-sm font-medium text-foreground">{home.churchEmail}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Church contact details will appear here when configured.</p>
      )}
    </footer>
  );
}
