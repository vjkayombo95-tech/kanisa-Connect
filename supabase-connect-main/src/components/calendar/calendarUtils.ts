import type {
  ParishCalendarCategory,
  ParishCalendarEvent,
  ParishCalendarEventType,
  ParishCalendarFilters,
  ParishCalendarView,
  ParishCalendarVisibility,
  ParishCalendarWorkspace,
  WorkflowCalendarItem,
} from "./types";
import type { AppLanguage } from "@/lib/localization";
import { formatLocalizedDate, formatLocalizedTime } from "@/lib/localization";

export const parishCalendarEventTypes: Array<{ value: ParishCalendarEventType; label: string; labelKey: string }> = [
  { value: "mass", label: "Mass", labelKey: "member_portal.parish_life.event_types.mass" },
  { value: "mass_intention", label: "Mass Intention", labelKey: "member_portal.parish_life.event_types.mass_intention" },
  { value: "confession", label: "Confession", labelKey: "member_portal.parish_life.event_types.confession" },
  { value: "adoration", label: "Adoration", labelKey: "member_portal.parish_life.event_types.adoration" },
  { value: "benediction", label: "Benediction", labelKey: "member_portal.parish_life.event_types.benediction" },
  { value: "stations_of_the_cross", label: "Stations of the Cross", labelKey: "member_portal.parish_life.event_types.stations_of_the_cross" },
  { value: "rosary", label: "Rosary", labelKey: "member_portal.parish_life.event_types.rosary" },
  { value: "procession", label: "Procession", labelKey: "member_portal.parish_life.event_types.procession" },
  { value: "prayer_meeting", label: "Prayer Meeting", labelKey: "member_portal.parish_life.event_types.prayer_meeting" },
  { value: "youth_meeting", label: "Youth Meeting", labelKey: "member_portal.parish_life.event_types.youth_meeting" },
  { value: "choir_practice", label: "Choir Practice", labelKey: "member_portal.parish_life.event_types.choir_practice" },
  { value: "catechism", label: "Catechism", labelKey: "member_portal.parish_life.event_types.catechism" },
  { value: "bible_study", label: "Bible Study", labelKey: "member_portal.parish_life.event_types.bible_study" },
  { value: "rcia", label: "RCIA / OCIA", labelKey: "member_portal.parish_life.event_types.rcia" },
  { value: "seminar", label: "Seminar / Formation Session", labelKey: "member_portal.parish_life.event_types.seminar" },
  { value: "baptism", label: "Baptism", labelKey: "member_portal.parish_life.event_types.baptism" },
  { value: "wedding", label: "Wedding", labelKey: "member_portal.parish_life.event_types.wedding" },
  { value: "confirmation", label: "Confirmation", labelKey: "member_portal.parish_life.event_types.confirmation" },
  { value: "first_communion", label: "First Holy Communion", labelKey: "member_portal.parish_life.event_types.first_communion" },
  { value: "anointing_of_sick", label: "Anointing of the Sick", labelKey: "member_portal.parish_life.event_types.anointing_of_sick" },
  { value: "funeral", label: "Funeral", labelKey: "member_portal.parish_life.event_types.funeral" },
  { value: "pastoral_visit", label: "Pastoral Visit", labelKey: "member_portal.parish_life.event_types.pastoral_visit" },
  { value: "community_help_visit", label: "Community Help Visit", labelKey: "member_portal.parish_life.event_types.community_help_visit" },
  { value: "council_meeting", label: "Council Meeting", labelKey: "member_portal.parish_life.event_types.council_meeting" },
  { value: "ministry_meeting", label: "Ministry Meeting", labelKey: "member_portal.parish_life.event_types.ministry_meeting" },
  { value: "community_meeting", label: "Community Meeting", labelKey: "member_portal.parish_life.event_types.community_meeting" },
  { value: "retreat", label: "Retreat", labelKey: "member_portal.parish_life.event_types.retreat" },
  { value: "training", label: "Training", labelKey: "member_portal.parish_life.event_types.training" },
  { value: "public_event", label: "Public Event", labelKey: "member_portal.parish_life.event_types.public_event" },
  { value: "liturgical", label: "Liturgical Day", labelKey: "member_portal.parish_life.event_types.liturgical" },
  { value: "daily_reading", label: "Daily Reading", labelKey: "member_portal.parish_life.event_types.daily_reading" },
  { value: "announcement", label: "Announcement", labelKey: "member_portal.parish_life.event_types.announcement" },
  { value: "attendance", label: "Attendance", labelKey: "member_portal.parish_life.event_types.attendance" },
  { value: "finance", label: "Finance", labelKey: "member_portal.parish_life.event_types.finance" },
  { value: "administration", label: "Administration", labelKey: "member_portal.parish_life.event_types.administration" },
  { value: "custom", label: "Custom", labelKey: "member_portal.parish_life.event_types.custom" },
];

export const parishCalendarCategories: Array<{
  value: ParishCalendarCategory;
  label: string;
  labelKey: string;
  color: string;
  icon: string;
}> = [
  { value: "mass", label: "Mass", labelKey: "member_portal.parish_life.categories.mass", color: "#d97706", icon: "church" },
  { value: "liturgical", label: "Liturgical", labelKey: "member_portal.parish_life.categories.liturgical", color: "#7c3aed", icon: "book-open" },
  { value: "prayer", label: "Prayer", labelKey: "member_portal.parish_life.categories.prayer", color: "#0ea5e9", icon: "heart" },
  { value: "ministry", label: "Ministry", labelKey: "member_portal.parish_life.categories.ministry", color: "#16a34a", icon: "users" },
  { value: "community", label: "Community", labelKey: "member_portal.parish_life.categories.community", color: "#0891b2", icon: "hand-heart" },
  { value: "meeting", label: "Meeting", labelKey: "member_portal.parish_life.categories.meeting", color: "#64748b", icon: "calendar-clock" },
  { value: "administration", label: "Administration", labelKey: "member_portal.parish_life.categories.administration", color: "#ea580c", icon: "clipboard-list" },
  { value: "finance", label: "Finance", labelKey: "member_portal.parish_life.categories.finance", color: "#15803d", icon: "wallet" },
  { value: "announcement", label: "Announcement", labelKey: "member_portal.parish_life.categories.announcement", color: "#dc2626", icon: "megaphone" },
  { value: "attendance", label: "Attendance", labelKey: "member_portal.parish_life.categories.attendance", color: "#2563eb", icon: "check-square" },
  { value: "custom", label: "Custom", labelKey: "member_portal.parish_life.categories.custom", color: "#6b7280", icon: "sparkles" },
];

export const parishCalendarViews: Array<{ value: ParishCalendarView; label: string; labelKey: string }> = [
  { value: "month", label: "Month", labelKey: "member_portal.parish_life.month" },
  { value: "week", label: "Week", labelKey: "member_portal.parish_life.week" },
  { value: "day", label: "Day", labelKey: "member_portal.parish_life.day" },
  { value: "agenda", label: "Agenda", labelKey: "member_portal.parish_life.agenda" },
  { value: "timeline", label: "Timeline", labelKey: "member_portal.parish_life.timeline" },
  { value: "today", label: "Today", labelKey: "member_portal.parish_life.today" },
];

export const parishCalendarVisibilities: Array<{ value: ParishCalendarVisibility; label: string; labelKey: string }> = [
  { value: "public", label: "Public", labelKey: "member_portal.parish_life.visibility.public" },
  { value: "member", label: "Member", labelKey: "member_portal.parish_life.visibility.member" },
  { value: "pastoral", label: "Pastoral", labelKey: "member_portal.parish_life.visibility.pastoral" },
  { value: "admin", label: "Admin", labelKey: "member_portal.parish_life.visibility.admin" },
  { value: "finance", label: "Finance", labelKey: "member_portal.parish_life.visibility.finance" },
];

export const parishCalendarWorkspaces: Array<{ value: ParishCalendarWorkspace; label: string; labelKey: string }> = [
  { value: "member", label: "Member", labelKey: "workspace.member.title" },
  { value: "pastoral", label: "Pastoral", labelKey: "workspace.pastoral.title" },
  { value: "church_admin", label: "Church Admin", labelKey: "workspace.church_admin.title" },
  { value: "finance", label: "Finance", labelKey: "workspace.finance.title" },
  { value: "super_admin", label: "Super Admin", labelKey: "workspace.super_admin.title" },
];

export const emptyParishCalendarFilters: ParishCalendarFilters = {
  eventType: "all",
  category: "all",
  ministry: "all",
  community: "all",
  church: "all",
  visibility: "all",
  workspace: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
};

export type ParishCalendarServiceOption = {
  value: string;
  label: string;
  labelKey?: string;
};

const calendarWorkspaceFilterAccess: Record<ParishCalendarWorkspace, ParishCalendarWorkspace[]> = {
  member: ["member"],
  pastoral: ["pastoral"],
  church_admin: ["member", "pastoral", "church_admin", "finance"],
  finance: ["finance"],
  super_admin: ["super_admin"],
};

const calendarVisibilityFilterAccess: Record<ParishCalendarWorkspace, ParishCalendarVisibility[]> = {
  member: ["public", "member"],
  pastoral: ["public", "member", "pastoral"],
  church_admin: ["public", "member", "pastoral", "admin", "finance"],
  finance: ["public", "finance"],
  super_admin: ["public", "member", "pastoral", "admin", "finance"],
};

export function getAuthorizedCalendarWorkspaceOptions(workspace: ParishCalendarWorkspace) {
  const allowed = new Set(calendarWorkspaceFilterAccess[workspace]);
  return parishCalendarWorkspaces.filter((item) => allowed.has(item.value));
}

export function getAuthorizedCalendarVisibilityOptions(workspace: ParishCalendarWorkspace) {
  const allowed = new Set(calendarVisibilityFilterAccess[workspace]);
  return parishCalendarVisibilities.filter((item) => allowed.has(item.value));
}

export function shouldShowCalendarWorkspaceFilter(workspace: ParishCalendarWorkspace) {
  return getAuthorizedCalendarWorkspaceOptions(workspace).length > 1;
}

export function sanitizeParishCalendarFilters(
  filters: ParishCalendarFilters,
  workspace: ParishCalendarWorkspace,
): ParishCalendarFilters {
  const workspaceOptions = getAuthorizedCalendarWorkspaceOptions(workspace);
  const workspaceValues = new Set(workspaceOptions.map((item) => item.value));
  const visibilityValues = new Set(getAuthorizedCalendarVisibilityOptions(workspace).map((item) => item.value));

  return {
    ...filters,
    workspace:
      filters.workspace !== "all" && (workspaceOptions.length <= 1 || !workspaceValues.has(filters.workspace))
        ? "all"
        : filters.workspace,
    visibility:
      filters.visibility !== "all" && !visibilityValues.has(filters.visibility)
        ? "all"
        : filters.visibility,
  };
}

export function getCalendarServiceValue(event: ParishCalendarEvent) {
  return event.ministry?.trim() || `event-type:${event.type}`;
}

export function getCalendarServiceOption(event: ParishCalendarEvent): ParishCalendarServiceOption {
  const ministry = event.ministry?.trim();
  if (ministry) {
    return {
      value: ministry,
      label: ministry,
    };
  }

  const eventType = parishCalendarEventTypes.find((item) => item.value === event.type);
  return {
    value: `event-type:${event.type}`,
    label: eventType?.label ?? eventTypeLabel(event.type),
    labelKey: eventType?.labelKey,
  };
}

export function getCalendarServiceOptions(events: ParishCalendarEvent[]) {
  const options = new Map<string, ParishCalendarServiceOption>();

  events.forEach((event) => {
    const option = getCalendarServiceOption(event);
    if (!options.has(option.value)) options.set(option.value, option);
  });

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthGridDays(date: Date) {
  const firstGridDay = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(firstGridDay, index));
}

export function getCalendarVisibleRange(view: ParishCalendarView, cursorDate: Date) {
  if (view === "month") {
    const days = monthGridDays(cursorDate);
    return {
      from: startOfDay(days[0]),
      to: endOfDay(days[days.length - 1]),
    };
  }

  if (view === "week" || view === "timeline") {
    const from = startOfWeek(cursorDate);
    return {
      from,
      to: endOfDay(addDays(from, 6)),
    };
  }

  if (view === "day" || view === "today") {
    const day = view === "today" ? new Date() : cursorDate;
    return {
      from: startOfDay(day),
      to: endOfDay(day),
    };
  }

  return {
    from: addDays(startOfDay(cursorDate), -45),
    to: endOfDay(addDays(startOfDay(cursorDate), 120)),
  };
}

export function dateKey(date: string | Date) {
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(date: string | Date, language: AppLanguage = "en", options?: Intl.DateTimeFormatOptions) {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatLocalizedDate(value, language, options ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatCalendarTime(date: string | Date, language: AppLanguage = "en", options?: Intl.DateTimeFormatOptions) {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatLocalizedTime(value, language, options ?? { hour: "2-digit", minute: "2-digit" });
}

export function eventTypeLabelKey(type: ParishCalendarEventType) {
  return parishCalendarEventTypes.find((item) => item.value === type)?.labelKey ?? "member_portal.parish_life.event_types.public_event";
}

export function eventTypeLabel(type: ParishCalendarEventType) {
  return parishCalendarEventTypes.find((item) => item.value === type)?.label ?? "Event";
}

export function categoryLabelKey(category: ParishCalendarCategory) {
  return parishCalendarCategories.find((item) => item.value === category)?.labelKey ?? "member_portal.parish_life.categories.custom";
}

export function categoryLabel(category: ParishCalendarCategory) {
  return parishCalendarCategories.find((item) => item.value === category)?.label ?? "Custom";
}

export function categoryColor(category: ParishCalendarCategory) {
  return parishCalendarCategories.find((item) => item.value === category)?.color ?? "#6b7280";
}

export function categoryIconName(category: ParishCalendarCategory) {
  return parishCalendarCategories.find((item) => item.value === category)?.icon ?? "sparkles";
}

export function categoryForEventType(type: ParishCalendarEventType): ParishCalendarCategory {
  if (type === "mass" || type === "mass_intention") return "mass";
  if (type === "liturgical" || type === "daily_reading") return "liturgical";
  if (type === "confession" || type === "adoration" || type === "benediction" || type === "stations_of_the_cross" || type === "rosary" || type === "procession" || type === "prayer_meeting") return "prayer";
  if (type === "youth_meeting" || type === "choir_practice" || type === "catechism" || type === "bible_study" || type === "rcia" || type === "seminar" || type === "ministry_meeting") return "ministry";
  if (type === "community_help_visit" || type === "community_meeting" || type === "public_event") return "community";
  if (type === "council_meeting") return "meeting";
  if (type === "announcement") return "announcement";
  if (type === "attendance") return "attendance";
  if (type === "finance") return "finance";
  if (type === "administration") return "administration";
  if (type === "baptism" || type === "wedding" || type === "confirmation" || type === "first_communion" || type === "anointing_of_sick" || type === "funeral" || type === "pastoral_visit" || type === "retreat") return "prayer";
  if (type === "training") return "ministry";
  return "custom";
}

export function inferEventType(value: string | null | undefined): ParishCalendarEventType {
  const text = (value ?? "").toLowerCase();
  const normalized = text.replace(/[\s-]+/g, "_");
  const exact = parishCalendarEventTypes.find((item) => item.value === normalized);
  if (exact) return exact.value;
  if (text.includes("confession") || text.includes("maungamo") || text.includes("reconciliation")) return "confession";
  if (text.includes("adoration")) return "adoration";
  if (text.includes("benediction")) return "benediction";
  if (text.includes("stations")) return "stations_of_the_cross";
  if (text.includes("rosary") || text.includes("rozari")) return "rosary";
  if (text.includes("procession")) return "procession";
  if (text.includes("prayer")) return "prayer_meeting";
  if (text.includes("announcement") || text.includes("bulletin")) return "announcement";
  if (text.includes("attendance") || text.includes("rsvp")) return "attendance";
  if (text.includes("finance") || text.includes("collection") || text.includes("pledge")) return "finance";
  if (text.includes("admin") || text.includes("invitation") || text.includes("registration")) return "administration";
  if (text.includes("reading") || text.includes("gospel")) return "daily_reading";
  if (text.includes("liturg")) return "liturgical";
  if (text.includes("intention")) return "mass_intention";
  if (text.includes("youth")) return "youth_meeting";
  if (text.includes("choir")) return "choir_practice";
  if (text.includes("catechism")) return "catechism";
  if (text.includes("bible study")) return "bible_study";
  if (text.includes("rcia") || text.includes("ocia")) return "rcia";
  if (text.includes("seminar")) return "seminar";
  if (text.includes("baptism") || text.includes("ubatizo")) return "baptism";
  if (text.includes("wedding") || text.includes("marriage") || text.includes("ndoa")) return "wedding";
  if (text.includes("confirmation") || text.includes("kipaimara")) return "confirmation";
  if (text.includes("communion") || text.includes("komunyo")) return "first_communion";
  if (text.includes("anointing") || text.includes("mpako")) return "anointing_of_sick";
  if (text.includes("funeral") || text.includes("mazishi")) return "funeral";
  if (text.includes("pastoral")) return "pastoral_visit";
  if (text.includes("help")) return "community_help_visit";
  if (text.includes("community")) return "community_meeting";
  if (text.includes("council")) return "council_meeting";
  if (text.includes("ministry")) return "ministry_meeting";
  if (text.includes("retreat")) return "retreat";
  if (text.includes("training")) return "training";
  if (text.includes("mass") || text.includes("misa")) return "mass";
  return "public_event";
}

export function workspaceCanSeeEvent(workspace: ParishCalendarWorkspace, event: ParishCalendarEvent) {
  if (workspace === "super_admin") return true;
  if (workspace === "church_admin") return event.visibility !== "finance" || event.workspace === "finance";
  if (workspace === "finance") {
    return event.visibility === "finance" || event.workspace === "finance" || event.type === "public_event" || event.category === "liturgical";
  }
  if (workspace === "pastoral") {
    return ["public", "member", "pastoral"].includes(event.visibility) || event.workspace === "pastoral";
  }
  return event.visibility === "public" || event.visibility === "member";
}

export function filterParishCalendarEvents(
  events: ParishCalendarEvent[],
  filters: ParishCalendarFilters,
  workspace: ParishCalendarWorkspace,
) {
  const search = filters.search.trim().toLowerCase();

  return events
    .filter((event) => workspaceCanSeeEvent(workspace, event))
    .filter((event) => filters.eventType === "all" || event.type === filters.eventType)
    .filter((event) => filters.category === "all" || event.category === filters.category)
    .filter((event) => filters.ministry === "all" || getCalendarServiceValue(event) === filters.ministry)
    .filter((event) => filters.community === "all" || event.community === filters.community)
    .filter((event) => filters.church === "all" || event.churchId === filters.church)
    .filter((event) => filters.visibility === "all" || event.visibility === filters.visibility)
    .filter((event) => filters.workspace === "all" || event.workspace === filters.workspace)
    .filter((event) => !filters.dateFrom || new Date(event.startsAt) >= startOfDay(new Date(`${filters.dateFrom}T00:00:00`)))
    .filter((event) => !filters.dateTo || new Date(event.startsAt) <= endOfDay(new Date(`${filters.dateTo}T00:00:00`)))
    .filter((event) => {
      if (!search) return true;
      return [event.title, event.description, event.location, event.ministry, event.churchName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function createWorkflowCalendarEvent(
  item: WorkflowCalendarItem,
  options: {
    module: string;
    eventType: ParishCalendarEventType;
    workspace: ParishCalendarWorkspace;
    visibility?: ParishCalendarVisibility;
  },
): ParishCalendarEvent | null {
  if (!item.scheduledAt) return null;

  return {
    id: `${options.module}-${item.id}`,
    title: item.title,
    description: item.description,
      type: options.eventType,
      category: categoryForEventType(options.eventType),
      startsAt: item.scheduledAt,
    endsAt: item.completedAt ?? null,
    location: item.location,
    ministry: item.ministry,
    churchId: item.churchId,
    churchName: item.churchName,
    visibility: options.visibility ?? "pastoral",
    workspace: options.workspace,
    source: "workflow",
    status: item.status ?? null,
    workflow: {
      module: options.module,
      recordId: item.id,
      state: item.status,
      href: item.href,
    },
  };
}
