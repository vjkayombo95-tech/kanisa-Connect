import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Megaphone, Plus, QrCode, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import {
  addDays,
  dateKey,
  emptyParishCalendarFilters,
  formatCalendarDate,
  getCalendarVisibleRange,
  getCalendarServiceOptions,
  sanitizeParishCalendarFilters,
  parishCalendarViews,
  startOfDay,
  startOfWeek,
  workspaceCanSeeEvent,
} from "./calendarUtils";
import { normalizeAppLanguage } from "@/lib/localization";
import { CalendarDayPanel } from "./CalendarDayPanel";
import { CalendarFilters } from "./CalendarFilters";
import { CalendarViews } from "./CalendarViews";
import type { ParishCalendarFilters, ParishCalendarView, ParishCalendarWorkspace } from "./types";

type ParishCalendarProps = {
  churchId: string | null | undefined;
  workspace: ParishCalendarWorkspace;
  title?: string;
  description?: string;
};

export function ParishCalendar({
  churchId,
  workspace,
  title,
  description,
}: ParishCalendarProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const [view, setView] = useState<ParishCalendarView>("month");
  const [cursorDate, setCursorDate] = useState(() => startOfDay(new Date()));
  const [filters, setFilters] = useState<ParishCalendarFilters>(() => readSavedFilters(workspace));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

  const visibleRange = useMemo(() => getCalendarVisibleRange(view, cursorDate), [view, cursorDate]);
  const { events, rawEvents, isLoading, isError } = useParishCalendarEvents({ churchId, filters, workspace, range: visibleRange });
  const authorizedRawEvents = useMemo(
    () => rawEvents.filter((event) => workspaceCanSeeEvent(workspace, event)),
    [rawEvents, workspace],
  );

  const services = useMemo(
    () => getCalendarServiceOptions(authorizedRawEvents),
    [authorizedRawEvents],
  );
  const communities = useMemo(
    () => Array.from(new Set(authorizedRawEvents.map((event) => event.community).filter(Boolean) as string[])).sort(),
    [authorizedRawEvents],
  );
  const eventTypes = useMemo(
    () => Array.from(new Set(authorizedRawEvents.map((event) => event.type))).sort(),
    [authorizedRawEvents],
  );
  const categories = useMemo(
    () => Array.from(new Set(authorizedRawEvents.map((event) => event.category))).sort(),
    [authorizedRawEvents],
  );
  const churches = useMemo(() => {
    const map = new Map<string, string>();
    authorizedRawEvents.forEach((event) => {
      if (event.churchId) map.set(event.churchId, event.churchName || "Current Church");
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [authorizedRawEvents]);

  const moveCursor = (direction: -1 | 1) => {
    const step = view === "month" ? 30 : view === "week" ? 7 : 1;
    setCursorDate((current) => addDays(current, direction * step));
  };

  useEffect(() => {
    window.localStorage.setItem(filterStorageKey(workspace), JSON.stringify(filters));
  }, [filters, workspace]);

  useEffect(() => {
    setFilters((current) => {
      const sanitized = sanitizeParishCalendarFilters(current, workspace);
      return areFiltersEqual(current, sanitized) ? current : sanitized;
    });
  }, [workspace]);

  const selectDay = (day: Date) => {
    setSelectedDate(day);
    setCursorDate(startOfDay(day));
    setDayPanelOpen(true);
  };

  const applyQuickFilter = (next: Partial<ParishCalendarFilters>) => {
    setFilters((current) => sanitizeParishCalendarFilters({ ...current, ...next }, workspace));
  };
  const clearFilters = () => setFilters(sanitizeParishCalendarFilters(emptyParishCalendarFilters, workspace));
  const hasActiveFilters = !areFiltersEqual(filters, sanitizeParishCalendarFilters(emptyParishCalendarFilters, workspace));

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {t("member_portal.parish_life.unified_calendar")}
          </p>
          <h1 className="mt-1 text-2xl font-bold font-serif text-foreground">{title ?? t("member_portal.parish_life.parish_calendar")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description ?? t("member_portal.parish_life.calendar_description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("member_portal.parish_life.previous_period")} onClick={() => moveCursor(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => {
            const today = startOfDay(new Date());
            setCursorDate(today);
            setSelectedDate(today);
          }}>
            {t("member_portal.parish_life.today")}
          </Button>
          <Button variant="outline" size="icon" aria-label={t("member_portal.parish_life.next_period")} onClick={() => moveCursor(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <NewMenu workspace={workspace} />
        </div>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={view} onValueChange={(value) => setView(value as ParishCalendarView)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {parishCalendarViews.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {t(item.labelKey, item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">{formatCalendarDate(cursorDate, language)}</p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={t("member_portal.parish_life.quick_filters")}>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ dateFrom: dateKey(new Date()), dateTo: dateKey(new Date()) })}>
          {t("member_portal.parish_life.today")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const start = startOfWeek(new Date());
            applyQuickFilter({ dateFrom: dateKey(start), dateTo: dateKey(addDays(start, 6)) });
          }}
        >
          {t("member_portal.parish_life.this_week")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ category: "mass" })}>
          {t("member_portal.parish_life.masses")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ category: "liturgical" })}>
          {t("member_portal.parish_life.categories.liturgical")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ category: "ministry" })}>
          {t("member_portal.parish_life.ministries")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ category: "community" })}>
          {t("member_portal.parish_life.communities")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyQuickFilter({ category: "announcement" })}>
          {t("member_portal.parish_life.announcements")}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          {t("member_portal.parish_life.clear_filters")}
        </Button>
      </div>

      <CalendarFilters
        filters={filters}
        workspace={workspace}
        services={services}
        communities={communities}
        churches={churches}
        eventTypes={eventTypes}
        categories={categories}
        onChange={(next) => setFilters(sanitizeParishCalendarFilters(next, workspace))}
      />
      <CalendarViews
        view={view}
        cursorDate={cursorDate}
        events={events}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        selectedDate={selectedDate}
        onDaySelect={selectDay}
      />
      <CalendarDayPanel
        open={dayPanelOpen}
        date={selectedDate}
        events={events}
        workspace={workspace}
        onOpenChange={setDayPanelOpen}
      />
    </div>
  );
}

function filterStorageKey(workspace: ParishCalendarWorkspace) {
  return `kanisa-parish-calendar-filters:${workspace}`;
}

function readSavedFilters(workspace: ParishCalendarWorkspace): ParishCalendarFilters {
  if (typeof window === "undefined") return emptyParishCalendarFilters;
  try {
    return sanitizeParishCalendarFilters(
      { ...emptyParishCalendarFilters, ...JSON.parse(window.localStorage.getItem(filterStorageKey(workspace)) || "{}") },
      workspace,
    );
  } catch {
    return emptyParishCalendarFilters;
  }
}

function areFiltersEqual(left: ParishCalendarFilters, right: ParishCalendarFilters) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function NewMenu({ workspace }: { workspace: ParishCalendarWorkspace }) {
  const { t } = useTranslation();
  const base = workspace === "pastoral" ? "/pastoral" : workspace === "finance" ? "/finance" : workspace === "church_admin" ? "/church-admin" : "/portal";
  const eventBase = workspace === "member" ? "/portal/events" : `${base}/events`;
  const items = [
    { label: t("member_portal.parish_life.parish_event"), to: eventBase, icon: CalendarPlus },
    { label: t("member_portal.parish_life.meeting"), to: eventBase, icon: Users },
    { label: t("member_portal.parish_life.event_types.retreat"), to: eventBase, icon: CalendarDays },
    { label: t("member_portal.parish_life.community_activity"), to: eventBase, icon: Users },
    { label: t("member_portal.parish_life.ministry_activity"), to: eventBase, icon: Users },
    { label: t("member_portal.parish_life.announcement"), to: `${base}/announcements`, icon: Megaphone },
    { label: t("member_portal.parish_life.generate_qr"), to: workspace === "church_admin" ? "/church-admin/qr-payments" : `${base}/calendar`, icon: QrCode },
    { label: t("member_portal.parish_life.mass_schedule"), to: workspace === "pastoral" ? "/pastoral/mass-schedule" : `${base}/calendar`, icon: Clock },
    { label: t("member_portal.parish_life.open_daily_readings"), to: `${base}/daily-readings`, icon: BookOpen },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("member_portal.parish_life.new")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("member_portal.parish_life.parish_calendar")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.label} asChild>
              <AppLink to={item.to}>
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {item.label}
              </AppLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
