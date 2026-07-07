import { BookOpen, CalendarPlus, Clock, QrCode, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  dateKey,
  formatCalendarDate,
} from "./calendarUtils";
import { normalizeAppLanguage } from "@/lib/localization";
import { CalendarEventCard } from "./CalendarEventCard";
import type { ParishCalendarEvent, ParishCalendarWorkspace } from "./types";

type CalendarDayPanelProps = {
  open: boolean;
  date: Date | null;
  events: ParishCalendarEvent[];
  workspace: ParishCalendarWorkspace;
  onOpenChange: (open: boolean) => void;
};

type PanelSection = {
  id: string;
  title: string;
  events: ParishCalendarEvent[];
};

export function CalendarDayPanel({ open, date, events, workspace, onOpenChange }: CalendarDayPanelProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const selectedKey = date ? dateKey(date) : null;
  const dayEvents = selectedKey ? events.filter((event) => dateKey(event.startsAt) === selectedKey) : [];
  const liturgical = dayEvents.find((event) => event.type === "liturgical");
  const readings = dayEvents.filter((event) => event.type === "daily_reading");
  const sections: PanelSection[] = [
    { id: "readings", title: t("member_portal.parish_life.todays_readings"), events: readings },
    { id: "mass", title: t("member_portal.parish_life.mass_schedule"), events: dayEvents.filter((event) => event.category === "mass" && event.type !== "mass_intention") },
    { id: "intentions", title: t("member_portal.parish_life.mass_intentions"), events: dayEvents.filter((event) => event.type === "mass_intention") },
    { id: "events", title: t("member_portal.parish_life.parish_events"), events: dayEvents.filter((event) => event.source === "events") },
    { id: "announcements", title: t("member_portal.parish_life.announcements"), events: dayEvents.filter((event) => event.category === "announcement") },
    { id: "ministry", title: t("member_portal.parish_life.ministry_activities"), events: dayEvents.filter((event) => event.category === "ministry") },
    { id: "community", title: t("member_portal.parish_life.community_activities"), events: dayEvents.filter((event) => event.category === "community") },
  ];
  const quickActions = getQuickActions(workspace, t);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <SheetHeader className="pr-8">
          <SheetDescription>{t("member_portal.parish_life.day_details")}</SheetDescription>
          <SheetTitle className="font-serif text-2xl">
            {date ? formatCalendarDate(date, language) : t("member_portal.parish_life.parish_calendar")}
          </SheetTitle>
          {liturgical ? (
            <p className="text-sm text-muted-foreground">
              {liturgical.title}
              {liturgical.description ? ` · ${liturgical.description}` : ""}
            </p>
          ) : null}
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`calendar-day-${section.id}`} className="space-y-2">
              <h3 id={`calendar-day-${section.id}`} className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              {section.events.length ? (
                <div className="space-y-2">
                  {section.events.map((event) => (
                    <CalendarEventCard key={event.id} event={event} compact />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                  {t("member_portal.parish_life.no_section_for_day", { section: section.title.toLowerCase() })}
                </p>
              )}
            </section>
          ))}

          <section aria-labelledby="calendar-day-quick-actions" className="space-y-2">
            <h3 id="calendar-day-quick-actions" className="text-sm font-semibold text-foreground">
              {t("member_portal.parish_life.quick_actions")}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.label} asChild variant="outline" className="justify-start">
                    <AppLink to={action.to}>
                      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                      {action.label}
                    </AppLink>
                  </Button>
                );
              })}
            </div>
          </section>

          {dayEvents.length ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {t("member_portal.parish_life.day_item_count", { count: dayEvents.length })}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getQuickActions(workspace: ParishCalendarWorkspace, t: (key: string, fallback?: string) => string) {
  const base = workspace === "pastoral" ? "/pastoral" : workspace === "finance" ? "/finance" : workspace === "church_admin" ? "/church-admin" : "/portal";
  const adminBase = workspace === "member" ? "/portal" : base;
  return [
    { label: t("member_portal.parish_life.parish_event"), to: `${adminBase}/events`, icon: CalendarPlus },
    { label: t("member_portal.parish_life.meeting"), to: `${adminBase}/events`, icon: Users },
    { label: t("member_portal.parish_life.announcement"), to: `${adminBase}/announcements`, icon: CalendarPlus },
    { label: t("member_portal.parish_life.generate_qr"), to: workspace === "church_admin" ? "/church-admin/qr-payments" : `${base}/calendar`, icon: QrCode },
    { label: t("member_portal.parish_life.mass_schedule"), to: workspace === "pastoral" ? "/pastoral/mass-schedule" : `${base}/calendar`, icon: Clock },
    { label: t("member_portal.parish_life.open_daily_readings"), to: `${base}/daily-readings`, icon: BookOpen },
  ];
}
