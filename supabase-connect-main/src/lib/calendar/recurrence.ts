import { addDays, dateKey, startOfDay } from "@/components/calendar/calendarUtils";

export type CalendarRecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type CalendarRecurrenceEndMode = "date" | "count";
export type CalendarMonthlyPattern = "day_of_month" | "nth_weekday";

export type CalendarRecurrenceRule = {
  frequency: CalendarRecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[] | null;
  endDate?: string | null;
  count?: number | null;
  monthlyPattern?: CalendarMonthlyPattern | null;
  monthlyWeek?: number | null;
  monthlyWeekday?: number | null;
};

export type CalendarRecurrenceParent = {
  id: string;
  startsAt: string;
  endsAt?: string | null;
  recurrence: CalendarRecurrenceRule;
};

export type CalendarOccurrence = {
  id: string;
  parentId: string;
  occurrenceDate: string;
  startsAt: string;
  endsAt: string | null;
  index: number;
};

export const MAX_RECURRENCE_OCCURRENCES = 370;
const MAX_LOOKAHEAD_DAYS = 735;

function localDateTime(date: Date, template: Date) {
  const next = new Date(date);
  next.setHours(template.getHours(), template.getMinutes(), template.getSeconds(), template.getMilliseconds());
  return next;
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function addMonthsClamped(date: Date, months: number, targetDay: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, week: number) {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (week - 1) * 7;
  const lastDay = new Date(year, month + 1, 0).getDate();
  if (day > lastDay) return null;
  return new Date(year, month, day);
}

function nthWeekOfMonth(date: Date) {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function inRange(date: Date, from: Date, to: Date) {
  return date >= startOfDay(from) && date <= to;
}

export function normalizeRecurrenceRule(rule: Partial<CalendarRecurrenceRule> | null | undefined): CalendarRecurrenceRule {
  const frequency = rule?.frequency === "daily" || rule?.frequency === "weekly" || rule?.frequency === "monthly" ? rule.frequency : "none";
  const interval = Number(rule?.interval ?? 1);
  return {
    frequency,
    interval: Number.isFinite(interval) ? interval : 1,
    daysOfWeek: Array.isArray(rule?.daysOfWeek) ? [...new Set(rule.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6))].sort() : null,
    endDate: rule?.endDate ?? null,
    count: rule?.count ?? null,
    monthlyPattern: rule?.monthlyPattern === "nth_weekday" ? "nth_weekday" : "day_of_month",
    monthlyWeek: rule?.monthlyWeek ?? null,
    monthlyWeekday: rule?.monthlyWeekday ?? null,
  };
}

export function validateRecurrenceRule(parent: CalendarRecurrenceParent) {
  const rule = normalizeRecurrenceRule(parent.recurrence);
  const errors: string[] = [];
  const start = new Date(parent.startsAt);
  const end = parent.endsAt ? new Date(parent.endsAt) : null;

  if (Number.isNaN(start.getTime())) errors.push("recurrence_start_invalid");
  if (end && end < start) errors.push("event_end_before_start");
  if (rule.frequency === "none") return errors;
  if (!["daily", "weekly", "monthly"].includes(rule.frequency)) errors.push("recurrence_frequency_invalid");
  if (!Number.isInteger(rule.interval) || rule.interval < 1) errors.push("recurrence_interval_invalid");
  if (rule.frequency === "weekly" && !rule.daysOfWeek?.length) errors.push("recurrence_weekdays_required");
  if (rule.endDate && startOfDay(new Date(`${rule.endDate}T00:00:00`)) < startOfDay(start)) errors.push("recurrence_end_before_start");
  if (rule.count != null && (!Number.isInteger(rule.count) || rule.count < 1)) errors.push("recurrence_count_invalid");
  if (!rule.endDate && !rule.count) errors.push("recurrence_end_required");
  if (rule.frequency === "monthly" && rule.monthlyPattern === "nth_weekday") {
    if (!rule.monthlyWeek || rule.monthlyWeek < 1 || rule.monthlyWeek > 5) errors.push("recurrence_monthly_week_invalid");
    if (rule.monthlyWeekday == null || rule.monthlyWeekday < 0 || rule.monthlyWeekday > 6) errors.push("recurrence_monthly_weekday_invalid");
  }

  return errors;
}

export function describeRecurrenceRule(ruleInput: Partial<CalendarRecurrenceRule> | null | undefined) {
  const rule = normalizeRecurrenceRule(ruleInput);
  if (rule.frequency === "none") return "One-time event";
  const intervalText = rule.interval > 1 ? `${rule.interval} ` : "";
  const unit = rule.frequency === "daily" ? "day" : rule.frequency === "weekly" ? "week" : "month";
  const plural = rule.interval > 1 ? "s" : "";
  const base = `Repeats every ${intervalText}${unit}${plural}`;
  if (rule.frequency === "weekly" && rule.daysOfWeek?.length) {
    const names = rule.daysOfWeek.map((day) => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(addDays(new Date(2026, 6, 5), day))).join(", ");
    return `${base} on ${names}`;
  }
  if (rule.frequency === "monthly" && rule.monthlyPattern === "nth_weekday" && rule.monthlyWeek && rule.monthlyWeekday != null) {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(addDays(new Date(2026, 6, 5), rule.monthlyWeekday));
    return `${base} on week ${rule.monthlyWeek} ${weekday}`;
  }
  return base;
}

export function expandRecurringCalendarEvent(parent: CalendarRecurrenceParent, from: Date, to: Date): CalendarOccurrence[] {
  const rule = normalizeRecurrenceRule(parent.recurrence);
  const errors = validateRecurrenceRule({ ...parent, recurrence: rule });
  if (rule.frequency === "none" || errors.length) return [];

  const start = new Date(parent.startsAt);
  const end = parent.endsAt ? new Date(parent.endsAt) : null;
  const duration = end && end > start ? end.getTime() - start.getTime() : 0;
  const rangeEnd = rule.endDate ? startOfDay(new Date(`${rule.endDate}T00:00:00`)) : addDays(startOfDay(start), MAX_LOOKAHEAD_DAYS);
  const last = rangeEnd < to ? rangeEnd : to;
  const occurrences: CalendarOccurrence[] = [];
  let generated = 0;

  const push = (date: Date) => {
    if (generated >= MAX_RECURRENCE_OCCURRENCES) return;
    if (rule.count && generated >= rule.count) return;
    const starts = localDateTime(date, start);
    generated += 1;
    if (!inRange(starts, from, to)) return;
    const day = dateKey(starts);
    occurrences.push({
      id: `event-${parent.id}-${day}`,
      parentId: parent.id,
      occurrenceDate: day,
      startsAt: formatLocalDateTime(starts),
      endsAt: duration > 0 ? formatLocalDateTime(new Date(starts.getTime() + duration)) : null,
      index: generated,
    });
  };

  if (rule.frequency === "daily") {
    for (let cursor = startOfDay(start); cursor <= last && generated < MAX_RECURRENCE_OCCURRENCES; cursor = addDays(cursor, rule.interval)) push(cursor);
  }

  if (rule.frequency === "weekly") {
    for (let cursor = startOfDay(start); cursor <= last && generated < MAX_RECURRENCE_OCCURRENCES; cursor = addDays(cursor, 1)) {
      const weekDelta = Math.floor((startOfDay(cursor).getTime() - startOfDay(start).getTime()) / 604800000);
      if (weekDelta % rule.interval !== 0) continue;
      if (!rule.daysOfWeek?.includes(cursor.getDay())) continue;
      if (cursor < startOfDay(start)) continue;
      push(cursor);
    }
  }

  if (rule.frequency === "monthly") {
    const targetDay = start.getDate();
    const monthlyWeek = rule.monthlyWeek ?? nthWeekOfMonth(start);
    const monthlyWeekday = rule.monthlyWeekday ?? start.getDay();
    for (let index = 0; generated < MAX_RECURRENCE_OCCURRENCES; index += rule.interval) {
      const candidate = rule.monthlyPattern === "nth_weekday"
        ? nthWeekdayOfMonth(start.getFullYear(), start.getMonth() + index, monthlyWeekday, monthlyWeek)
        : addMonthsClamped(startOfDay(start), index, targetDay);
      if (!candidate) continue;
      if (candidate > last) break;
      push(candidate);
    }
  }

  return occurrences;
}
