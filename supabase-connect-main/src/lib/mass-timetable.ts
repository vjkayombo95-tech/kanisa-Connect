export const MASS_RESERVING_STATUSES = ["pending", "approved", "scheduled", "completed", "archived"] as const;

export const MASS_WEEKDAYS = ["Jumapili", "Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi"] as const;

export const TIMETABLE_ACTIVITY_TYPES = ["mass", "confession", "adoration", "prayer", "other"] as const;
export type TimetableActivityType = (typeof TIMETABLE_ACTIVITY_TYPES)[number];
export type TimetableActivityClassification = TimetableActivityType | null;

export const TIMETABLE_ACTIVITY_LABEL_KEYS = {
  mass: "mass_timetable_admin.activity_types.mass",
  confession: "mass_timetable_admin.activity_types.confession",
  adoration: "mass_timetable_admin.activity_types.adoration",
  prayer: "mass_timetable_admin.activity_types.prayer",
  other: "mass_timetable_admin.activity_types.other",
  unclassified: "mass_timetable_admin.activity_types.unclassified",
} as const;

export type MassSchedule = {
  id: string; church_id: string; name: string; day_of_week: number; start_time: string; end_time: string | null;
  location_name: string | null; language: string | null; default_celebrant_name: string | null;
  intention_capacity: number | null; default_intention_fee: number | null; accepts_intentions: boolean;
  effective_from: string; effective_until: string | null; is_active: boolean; activity_type?: TimetableActivityClassification;
};

export type MassOccurrence = {
  id: string; church_id: string; mass_schedule_id: string | null; occurrence_date: string; start_time: string;
  end_time: string | null; name: string; location_name: string | null; language: string | null;
  celebrant_name: string | null; intention_capacity: number | null; intention_fee: number | null;
  accepts_intentions: boolean; status: "scheduled" | "cancelled" | "completed" | "rescheduled";
  is_special_mass: boolean; notes: string | null; activity_type?: TimetableActivityClassification;
};

export const formatMassTime = (value?: string | null) => value ? value.slice(0, 5) : "-";
export const formatMassDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("sw-TZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const validateMassTimes = (start: string, end?: string | null) => !end || end > start;
