import { supabase } from "@/integrations/supabase/client";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";

export type ParishIdentity = {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};
export type ParishEvent = { id: string; churchId: string; title: string; description: string | null; startDate: string; location: string | null };
export type MemberNextMass = {
  id: string;
  title: string;
  description: string | null;
  massDate: string;
  startTime: string;
  endTime: string | null;
  responseDeadline: string | null;
  askForRsvp: boolean;
  memberId: string | null;
  memberResponse: "yes" | "maybe" | "no" | null;
};

export type MemberNextMassSummary = {
  mass: MemberNextMass | null;
  responseCounts: { yes: number; maybe: number; no: number };
  responseRate: number;
};

export type MemberParishScheduleOccurrence = {
  id: string;
  occurrence_date: string | null;
  start_time: string | null;
  name: string;
  location_name: string | null;
  status: string | null;
  activity_type: string | null;
};

export const dailyLifeKeys = {
  parish: (churchId?: string | null) => ["member-parish-identity", churchId] as const,
  events: (churchId?: string | null) => ["portal-events", churchId] as const,
  nextMass: (churchId?: string | null) => ["member-daily-life", "next-mass", churchId] as const,
  nextTimetableMass: (churchId?: string | null) => ["member-daily-life", "next-timetable-mass", churchId] as const,
  announcements: (churchId?: string | null) => ["portal-announcements", churchId, 1] as const,
};

const PHONE_CHARACTERS = /^[\d\s()+\-.*#,;pPwW]+$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TANZANIA_TIME_ZONE = "Africa/Dar_es_Salaam";
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TANZANIA_TIME_ZONE,
  year: "numeric",
});
const timeKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: TANZANIA_TIME_ZONE,
});

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function normalizeParishContact(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/gu, " ") ?? "";
  return normalized && !hasControlCharacters(normalized) ? normalized : null;
}

export function getTanzaniaDateKey(value = new Date()) {
  return dateKeyFormatter.format(value);
}

export function getTanzaniaTimeKey(value = new Date()) {
  return timeKeyFormatter.format(value);
}

function getValidDateKey(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : null;
}

function getValidTimeKey(value: string | null) {
  const match = value?.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return null;

  const [, hourText, minuteText, secondText = "00"] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${hourText}:${minuteText}`;
}

function getFutureTimetableMassCandidate(row: MemberParishScheduleOccurrence, todayKey: string, nowTimeKey: string) {
  if (row.activity_type !== "mass") return null;
  if (!["scheduled", "rescheduled"].includes(row.status ?? "")) return null;
  const dateKey = getValidDateKey(row.occurrence_date);
  const timeKey = getValidTimeKey(row.start_time);
  if (!dateKey || !timeKey) return null;
  if (dateKey < todayKey) return null;
  if (dateKey === todayKey && timeKey < nowTimeKey) return null;
  return { row, dateKey, timeKey };
}

export function getParishPhoneHref(value: string | null | undefined) {
  if (!value || hasControlCharacters(value)) return null;
  const normalized = normalizeParishContact(value);
  if (!normalized || !PHONE_CHARACTERS.test(normalized) || !/\d/.test(normalized)) return null;
  const dialValue = normalized.replace(/[\s().-]/g, "");
  return /^\+?[\d*#,;pPwW]+$/.test(dialValue) ? `tel:${dialValue}` : null;
}

export function getParishEmailHref(value: string | null | undefined) {
  if (!value || hasControlCharacters(value)) return null;
  const normalized = normalizeParishContact(value);
  if (!normalized || normalized.includes("?") || normalized.includes("#") || !EMAIL_ADDRESS.test(normalized)) return null;
  return `mailto:${encodeURIComponent(normalized)}`;
}

export function getParishMapHref(value: string | null | undefined) {
  const normalized = normalizeParishContact(value);
  return normalized
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`
    : null;
}

export function normalizeCoordinate(value: number | null | undefined, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function getParishDirectionsHref(
  location: Pick<ParishIdentity, "address" | "latitude" | "longitude"> | null | undefined,
) {
  if (!location) return null;
  const latitude = normalizeCoordinate(location.latitude, -90, 90);
  const longitude = normalizeCoordinate(location.longitude, -180, 180);
  if (latitude !== null && longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  return getParishMapHref(location.address);
}

export async function fetchParishIdentity(churchId: string): Promise<ParishIdentity | null> {
  if (!churchId) return null;
  const { data, error } = await supabase.from("churches").select("id,name,logo_url,phone,email,address,latitude,longitude").eq("id", churchId).maybeSingle();
  if (error) throw error;
  if (!data || data.id !== churchId) return null;
  return {
    id: data.id,
    name: data.name,
    logoUrl: normalizeParishContact(data.logo_url),
    phone: normalizeParishContact(data.phone),
    email: normalizeParishContact(data.email),
    address: normalizeParishContact(data.address),
    latitude: normalizeCoordinate(data.latitude, -90, 90),
    longitude: normalizeCoordinate(data.longitude, -180, 180),
  };
}

export async function fetchParishEvents(churchId: string): Promise<ParishEvent[]> {
  const { data, error } = await supabase.from("events").select("id,church_id,title,description,start_date,location,archived_at").eq("church_id", churchId).is("archived_at", null).order("start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((row) => row.church_id === churchId).map((row) => ({ id: row.id, churchId: row.church_id, title: row.title, description: row.description, startDate: row.start_date, location: row.location }));
}

export function normalizeNextMassSummary(value: unknown): MemberNextMassSummary {
  const payload = (value ?? {}) as {
    mass?: {
      id: string; title: string; description?: string | null; mass_date: string; start_time: string;
      end_time?: string | null; response_deadline?: string | null; ask_for_rsvp?: boolean;
      my_member_id?: string | null; my_response?: "yes" | "maybe" | "no" | null;
    } | null;
    yes_count?: number; maybe_count?: number; no_count?: number; response_rate?: number;
  };
  const mass = payload.mass;
  return {
    mass: mass ? {
      id: mass.id,
      title: mass.title,
      description: mass.description ?? null,
      massDate: mass.mass_date,
      startTime: mass.start_time,
      endTime: mass.end_time ?? null,
      responseDeadline: mass.response_deadline ?? null,
      askForRsvp: mass.ask_for_rsvp === true,
      memberId: mass.my_member_id ?? null,
      memberResponse: mass.my_response ?? null,
    } : null,
    responseCounts: {
      yes: Number(payload.yes_count ?? 0),
      maybe: Number(payload.maybe_count ?? 0),
      no: Number(payload.no_count ?? 0),
    },
    responseRate: Number(payload.response_rate ?? 0),
  };
}

export function selectNextTimetableMass(
  rows: MemberParishScheduleOccurrence[],
  now = new Date(),
): MemberNextMass | null {
  const todayKey = getTanzaniaDateKey(now);
  const nowTimeKey = getTanzaniaTimeKey(now);
  const next = rows
    .map((row) => getFutureTimetableMassCandidate(row, todayKey, nowTimeKey))
    .filter((candidate): candidate is { row: MemberParishScheduleOccurrence; dateKey: string; timeKey: string } => candidate !== null)
    .sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
      || a.timeKey.localeCompare(b.timeKey)
      || a.row.id.localeCompare(b.row.id)
    )[0];

  if (!next) return null;

  return {
    id: next.row.id,
    title: next.row.name,
    description: normalizeParishContact(next.row.location_name),
    massDate: next.dateKey,
    startTime: next.timeKey,
    endTime: null,
    responseDeadline: null,
    askForRsvp: false,
    memberId: null,
    memberResponse: null,
  };
}

export async function fetchNextMassSummary(churchId: string): Promise<MemberNextMassSummary> {
  const { data, error } = await supabase.rpc("get_next_mass_summary" as never, { p_church_id: churchId } as never);
  if (error) throw error;
  return normalizeNextMassSummary(data);
}

export async function fetchNextTimetableMass(churchId: string): Promise<MemberNextMass | null> {
  const now = new Date();
  const { data, error } = await supabase.rpc("get_member_parish_schedule_masses", {
    p_church_id: churchId,
    p_from_date: getTanzaniaDateKey(now),
  });
  if (error) throw error;
  return selectNextTimetableMass((data ?? []) as MemberParishScheduleOccurrence[], now);
}

export async function fetchLatestAnnouncement(churchId: string) {
  const rows = await fetchPortalAnnouncements(churchId, 1);
  return rows.find((row) => row.church_id === churchId) ?? null;
}

export function isEventToday(event: ParishEvent, now = new Date()) {
  const date = new Date(event.startDate);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function isUpcomingEvent(event: ParishEvent, now = new Date()) {
  return new Date(event.startDate).getTime() >= now.getTime();
}
