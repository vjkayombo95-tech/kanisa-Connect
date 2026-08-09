import type { WorkflowState } from "@/components/workflow";

export type ParishCalendarView = "month" | "week" | "day" | "agenda" | "timeline" | "today";

export type ParishCalendarEventType =
  | "mass"
  | "mass_intention"
  | "confession"
  | "adoration"
  | "benediction"
  | "stations_of_the_cross"
  | "rosary"
  | "procession"
  | "prayer_meeting"
  | "youth_meeting"
  | "choir_practice"
  | "catechism"
  | "bible_study"
  | "rcia"
  | "seminar"
  | "baptism"
  | "wedding"
  | "confirmation"
  | "first_communion"
  | "anointing_of_sick"
  | "funeral"
  | "pastoral_visit"
  | "community_help_visit"
  | "council_meeting"
  | "ministry_meeting"
  | "community_meeting"
  | "retreat"
  | "training"
  | "public_event"
  | "liturgical"
  | "daily_reading"
  | "announcement"
  | "attendance"
  | "finance"
  | "administration"
  | "custom";

export type ParishCalendarCategory =
  | "mass"
  | "liturgical"
  | "prayer"
  | "ministry"
  | "community"
  | "meeting"
  | "administration"
  | "finance"
  | "announcement"
  | "attendance"
  | "custom";

export type ParishCalendarVisibility = "public" | "member" | "pastoral" | "admin" | "finance";
export type ParishCalendarWorkspace = "member" | "pastoral" | "church_admin" | "finance" | "super_admin";
export type ParishEventAudienceMode = "everyone" | "all_members" | "specific_groups";

export type ParishEventAudienceTarget = {
  type: "ministry" | "community";
  id: string;
  name: string;
};

export type ParishCalendarWorkflowRef = {
  module: string;
  recordId: string;
  state?: WorkflowState | string | null;
  href?: string;
};

export type ParishCalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: ParishCalendarEventType;
  category: ParishCalendarCategory;
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  location?: string | null;
  ministry?: string | null;
  community?: string | null;
  churchId?: string | null;
  churchName?: string | null;
  visibility: ParishCalendarVisibility;
  audienceMode?: ParishEventAudienceMode;
  audienceTargets?: ParishEventAudienceTarget[];
  workspace: ParishCalendarWorkspace | "shared";
  source:
    | "events"
    | "mass_events"
    | "mass_intentions"
    | "liturgical_calendar"
    | "daily_readings"
    | "announcements"
    | "event_requests"
    | "workflow"
    | "generated"
    | "external";
  href?: string | null;
  color?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
  workflow?: ParishCalendarWorkflowRef | null;
};

export type ParishCalendarFilters = {
  eventType: ParishCalendarEventType | "all";
  category: ParishCalendarCategory | "all";
  ministry: string;
  community: string;
  church: string;
  visibility: ParishCalendarVisibility | "all";
  workspace: ParishCalendarWorkspace | "all";
  dateFrom: string;
  dateTo: string;
  search: string;
};

export type WorkflowCalendarItem = {
  id: string;
  title: string;
  scheduledAt: string | null;
  completedAt?: string | null;
  description?: string | null;
  location?: string | null;
  status?: WorkflowState | string | null;
  churchId?: string | null;
  churchName?: string | null;
  ministry?: string | null;
  href?: string;
};
