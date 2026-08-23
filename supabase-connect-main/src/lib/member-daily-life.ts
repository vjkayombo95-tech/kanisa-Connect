import { supabase } from "@/integrations/supabase/client";
import { fetchPortalAnnouncements } from "@/lib/portal-announcements";

export type ParishIdentity = { id: string; name: string; logoUrl: string | null };
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

export const dailyLifeKeys = {
  parish: (churchId?: string | null) => ["member-parish-identity", churchId] as const,
  events: (churchId?: string | null) => ["portal-events", churchId] as const,
  nextMass: (churchId?: string | null) => ["member-daily-life", "next-mass", churchId] as const,
  announcements: (churchId?: string | null) => ["portal-announcements", churchId, 1] as const,
};

export async function fetchParishIdentity(churchId: string): Promise<ParishIdentity | null> {
  const { data, error } = await supabase.from("churches").select("id,name,logo_url").eq("id", churchId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, name: data.name, logoUrl: data.logo_url } : null;
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

export async function fetchNextMassSummary(churchId: string): Promise<MemberNextMassSummary> {
  const { data, error } = await supabase.rpc("get_next_mass_summary" as never, { p_church_id: churchId } as never);
  if (error) throw error;
  return normalizeNextMassSummary(data);
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
