// `archived` is a storage/lifecycle state, not evidence that the intention was
// rejected or cancelled. It therefore continues to reserve its occurrence slot.
export const MASS_RESERVING_STATUSES = ["pending", "approved", "scheduled", "completed", "archived"] as const;

export const MASS_WEEKDAYS = [
  "Jumapili",
  "Jumatatu",
  "Jumanne",
  "Jumatano",
  "Alhamisi",
  "Ijumaa",
  "Jumamosi",
] as const;

export type MassSchedule = {
  id: string;
  church_id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  location_id: string | null;
  location_name: string | null;
  language: string | null;
  default_celebrant_name: string | null;
  intention_capacity: number | null;
  default_intention_fee: number | null;
  accepts_intentions: boolean;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  sort_order: number;
};

export type MassOccurrenceStatus = "scheduled" | "cancelled" | "completed" | "rescheduled";

export type MassOccurrence = {
  id: string;
  church_id: string;
  mass_schedule_id: string | null;
  occurrence_date: string;
  start_time: string;
  end_time: string | null;
  name: string;
  location_id: string | null;
  location_name: string | null;
  language: string | null;
  celebrant_name: string | null;
  intention_capacity: number | null;
  intention_fee: number | null;
  accepts_intentions: boolean;
  status: MassOccurrenceStatus;
  is_special_mass: boolean;
  notes: string | null;
  booked_count?: number;
  remaining_slots?: number | null;
  is_full?: boolean;
};

export function formatMassTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 5);
}

export function formatMassDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function calculateMassAvailability(capacity: number | null, bookedCount: number) {
  if (capacity == null) return { remainingSlots: null, isFull: false };
  const remainingSlots = Math.max(capacity - bookedCount, 0);
  return { remainingSlots, isFull: remainingSlots === 0 };
}

export function validateMassTimes(startTime: string, endTime: string | null | undefined) {
  return !endTime || endTime > startTime;
}

export function occurrenceDisplay(
  occurrence: Pick<MassOccurrence, "name" | "occurrence_date" | "start_time" | "location_name">,
) {
  return {
    name: occurrence.name,
    date: occurrence.occurrence_date,
    time: formatMassTime(occurrence.start_time),
    location: occurrence.location_name || "Kanisa kuu",
  };
}
