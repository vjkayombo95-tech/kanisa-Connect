import { memo } from "react";
import { BookOpen, CalendarClock, CalendarDays, Church, Heart, Megaphone, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/page-state";
import { cn } from "@/lib/utils";
import type { AppLanguage } from "@/lib/localization";
import { normalizeAppLanguage } from "@/lib/localization";
import {
  addDays,
  dateKey,
  formatCalendarDate,
  formatCalendarTime,
  categoryIconName,
  monthGridDays,
  startOfDay,
  startOfWeek,
} from "./calendarUtils";
import { CalendarEventCard } from "./CalendarEventCard";
import type { ParishCalendarEvent, ParishCalendarView } from "./types";

type CalendarViewsProps = {
  view: ParishCalendarView;
  cursorDate: Date;
  events: ParishCalendarEvent[];
  isLoading?: boolean;
  isError?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  selectedDate?: Date | null;
  onDaySelect?: (date: Date) => void;
};

export function CalendarViews({ view, cursorDate, events, isLoading, isError, hasActiveFilters, onClearFilters, selectedDate, onDaySelect }: CalendarViewsProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  if (isLoading) return <CalendarSkeleton />;

  if (isError) {
    return (
      <ErrorState
        kind="network"
        title={t("member_portal.parish_life.calendar_load_error")}
        description={t("member_portal.parish_life.calendar_load_error_description")}
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
        title={t(hasActiveFilters ? "member_portal.parish_life.no_filtered_items" : "member_portal.parish_life.no_scheduled_items")}
        description={t(hasActiveFilters ? "member_portal.parish_life.no_filtered_items_description" : "member_portal.parish_life.no_scheduled_items_description")}
        action={
          hasActiveFilters && onClearFilters ? (
            <button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={onClearFilters}>
              {t("member_portal.parish_life.clear_filters")}
            </button>
          ) : undefined
        }
        className="rounded-[28px]"
      />
    );
  }

  if (view === "month") return <MonthView cursorDate={cursorDate} events={events} selectedDate={selectedDate} onDaySelect={onDaySelect} language={language} />;
  if (view === "week") return <WeekView cursorDate={cursorDate} events={events} language={language} />;
  if (view === "day" || view === "today") return <DayView cursorDate={view === "today" ? new Date() : cursorDate} events={events} language={language} />;
  if (view === "timeline") return <TimelineView events={events} cursorDate={cursorDate} language={language} />;
  return <AgendaView events={events} />;
}

function eventsForDay(events: ParishCalendarEvent[], day: Date) {
  const key = dateKey(day);
  return events.filter((event) => dateKey(event.startsAt) === key);
}

const MonthView = memo(function MonthView({
  cursorDate,
  events,
  selectedDate,
  onDaySelect,
  language,
}: {
  cursorDate: Date;
  events: ParishCalendarEvent[];
  selectedDate?: Date | null;
  onDaySelect?: (date: Date) => void;
  language: AppLanguage;
}) {
  const { t } = useTranslation();
  const days = monthGridDays(cursorDate);
  const currentMonth = cursorDate.getMonth();
  const todayKey = dateKey(new Date());
  const activeKey = selectedDate ? dateKey(selectedDate) : null;

  return (
    <div className="rounded-[28px] border border-border/70 bg-card/85 p-3" role="grid" aria-label={t("member_portal.parish_life.month_view")}>
      <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs font-medium text-muted-foreground">
        {Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(language === "sw" ? "sw-TZ" : "en-US", { weekday: "short" }).format(addDays(startOfWeek(new Date()), index))).map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const key = dateKey(day);
          return (
            <button
              type="button"
              key={day.toISOString()}
              className={cn(
                "min-h-32 rounded-2xl border border-border/60 bg-background/60 p-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                day.getMonth() !== currentMonth && "opacity-55",
                key === todayKey && "border-primary/60 ring-1 ring-primary/30",
                key === activeKey && "bg-primary/10",
              )}
              role="gridcell"
              aria-label={t("member_portal.parish_life.day_events_count", { date: formatCalendarDate(day, language), count: dayEvents.length })}
              onClick={() => onDaySelect?.(day)}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                <span>{day.getDate()}</span>
                {key === todayKey ? <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{t("member_portal.parish_life.today")}</span> : null}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-xs"
                    style={{
                      backgroundColor: event.color ? `${event.color}1f` : undefined,
                      color: event.color ?? undefined,
                    }}
                  >
                    <CategoryGlyph event={event} />
                    <span className="shrink-0 font-medium">{event.allDay ? t("member_portal.parish_life.all_day") : formatCalendarTime(event.startsAt, language)}</span>
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 ? (
                  <p className="px-2 text-xs text-muted-foreground">{t("member_portal.parish_life.more_count", { count: dayEvents.length - 3 })}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

function WeekView({ cursorDate, events, language }: { cursorDate: Date; events: ParishCalendarEvent[]; language: AppLanguage }) {
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursorDate), index));

  return (
    <div className="grid gap-3 lg:grid-cols-7" aria-label={t("member_portal.parish_life.week_view")}>
      {days.map((day) => {
        const dayEvents = eventsForDay(events, day);
        return (
          <section key={day.toISOString()} className="space-y-2 rounded-[24px] border border-border/70 bg-card/85 p-3">
            <h2 className="text-sm font-semibold">{formatCalendarDate(day, language)}</h2>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("member_portal.parish_life.no_items_for_day")}</p>
            ) : (
              dayEvents.map((event) => <CalendarEventCard key={event.id} event={event} compact />)
            )}
          </section>
        );
      })}
    </div>
  );
}

function DayView({ cursorDate, events, language }: { cursorDate: Date; events: ParishCalendarEvent[]; language: AppLanguage }) {
  const { t } = useTranslation();
  const dayEvents = eventsForDay(events, startOfDay(cursorDate));

  return (
    <section className="space-y-3" aria-label={t("member_portal.parish_life.day_view")}>
      <h2 className="text-lg font-semibold">{formatCalendarDate(cursorDate, language)}</h2>
      {dayEvents.length === 0 ? (
        <Card className="rounded-[28px] border-border/70 bg-card/85">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("member_portal.parish_life.no_scheduled_for_day")}
          </CardContent>
        </Card>
      ) : (
        dayEvents.map((event) => <CalendarEventCard key={event.id} event={event} />)
      )}
    </section>
  );
}

function AgendaView({ events }: { events: ParishCalendarEvent[] }) {
  const { t } = useTranslation();
  const visibleEvents = events.slice(0, 80);

  return (
    <section className="space-y-3" aria-label={t("member_portal.parish_life.agenda_view")}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {visibleEvents.map((event) => (
          <CalendarEventCard key={event.id} event={event} />
        ))}
      </div>
      {events.length > visibleEvents.length ? (
        <p className="text-sm text-muted-foreground">
          {t("member_portal.parish_life.showing_first_items", { count: visibleEvents.length })}
        </p>
      ) : null}
    </section>
  );
}

function TimelineView({ events, cursorDate, language }: { events: ParishCalendarEvent[]; cursorDate: Date; language: AppLanguage }) {
  const { t } = useTranslation();
  const weekStart = startOfWeek(cursorDate);
  const weekEnd = addDays(weekStart, 6);
  const visibleEvents = events.filter((event) => {
    const value = new Date(event.startsAt);
    return value >= weekStart && value <= addDays(weekEnd, 1);
  });
  const grouped = visibleEvents.reduce<Record<string, ParishCalendarEvent[]>>((map, event) => {
    const key = dateKey(event.startsAt);
    map[key] = [...(map[key] ?? []), event];
    return map;
  }, {});
  const days = Object.keys(grouped).sort();

  if (!days.length) {
    return (
      <Card className="rounded-[28px] border-border/70 bg-card/85">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t("member_portal.parish_life.no_timeline_items")}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5" aria-label={t("member_portal.parish_life.timeline_label")}>
      {days.map((day) => (
        <div key={day} className="space-y-3">
          <h2 className="text-base font-semibold">{formatCalendarDate(`${day}T00:00:00`, language)}</h2>
          <div className="space-y-3 border-l border-border/70 pl-4">
            {grouped[day].map((event) => (
              <div key={event.id} className="relative">
                <span
                  className="absolute -left-[23px] top-4 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ backgroundColor: event.color ?? undefined }}
                  aria-hidden="true"
                />
                <div className="grid gap-2 sm:grid-cols-[5.5rem_1fr]">
                  <span className="pt-3 text-xs font-semibold text-muted-foreground">
                    {event.allDay ? t("member_portal.parish_life.all_day") : formatCalendarTime(event.startsAt, language)}
                  </span>
                  <CalendarEventCard event={event} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function CalendarSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" aria-label={t("member_portal.parish_life.loading_calendar")}>
      <Skeleton className="h-36 rounded-[28px]" />
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-40 rounded-[28px]" />
        <Skeleton className="h-40 rounded-[28px]" />
      </div>
    </div>
  );
}

function CategoryGlyph({ event }: { event: ParishCalendarEvent }) {
  const Icon = getIcon(event);
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function getIcon(event: ParishCalendarEvent) {
  const icon = categoryIconName(event.category);
  if (icon === "church") return Church;
  if (icon === "book-open") return BookOpen;
  if (icon === "heart") return Heart;
  if (icon === "users") return Users;
  if (icon === "calendar-clock") return CalendarClock;
  if (icon === "megaphone") return Megaphone;
  return Sparkles;
}
