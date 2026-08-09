import { supabase } from "@/integrations/supabase/client";

export type ChurchLivestreamStatus = "scheduled" | "live" | "ended" | "cancelled";
export type ChurchLivestreamProvider = "youtube" | "facebook" | "vimeo" | "custom";

export type ChurchLivestream = {
  id: string;
  churchId: string;
  status: ChurchLivestreamStatus;
  title: string;
  provider: ChurchLivestreamProvider;
  watchUrl: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  recordingUrl: string | null;
  thumbnailUrl: string | null;
  providerExternalId: string | null;
  providerStatus: ChurchLivestreamStatus | "unknown" | null;
  providerLastCheckedAt: string | null;
  providerLastErrorCategory: string | null;
  statusSource: "manual" | "provider" | "system";
};

export type MemberLivestreamPresentation = "live" | "upcoming" | null;

const UPCOMING_WINDOW_MS = 30 * 60 * 1000;

export function getMemberLivestreamPresentation(
  stream: ChurchLivestream | null | undefined,
  now = Date.now(),
): MemberLivestreamPresentation {
  if (!stream) return null;
  if (stream.status === "live") return "live";
  if (stream.status !== "scheduled" || !stream.scheduledStart) return null;

  const startsAt = new Date(stream.scheduledStart).getTime();
  if (!Number.isFinite(startsAt)) return null;
  const timeUntilStart = startsAt - now;
  return timeUntilStart >= 0 && timeUntilStart <= UPCOMING_WINDOW_MS ? "upcoming" : null;
}

type LivestreamRow = Database["public"]["Tables"]["church_livestreams"]["Row"];
type Database = import("@/integrations/supabase/types").Database;

export const churchLivestreamQueryKey = (churchId: string | null | undefined) => ["church-livestreams", churchId] as const;

export function normalizeChurchLivestream(row: LivestreamRow): ChurchLivestream {
  return {
    id: row.id, churchId: row.church_id, status: row.status as ChurchLivestreamStatus,
    title: row.title, provider: row.provider as ChurchLivestreamProvider, watchUrl: row.watch_url,
    scheduledStart: row.scheduled_start, scheduledEnd: row.scheduled_end,
    actualStartedAt: row.actual_started_at, actualEndedAt: row.actual_ended_at,
    recordingUrl: row.recording_url, thumbnailUrl: row.thumbnail_url,
    providerExternalId: row.provider_external_id,
    providerStatus: row.provider_status as ChurchLivestream["providerStatus"],
    providerLastCheckedAt: row.provider_last_checked_at,
    providerLastErrorCategory: row.provider_last_error_category,
    statusSource: row.status_source as ChurchLivestream["statusSource"],
  };
}

export async function fetchChurchLivestreams(churchId: string) {
  const { data, error } = await supabase.from("church_livestreams").select("*").eq("church_id", churchId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeChurchLivestream);
}

export async function fetchMemberLivestream(churchId: string, includeRecording = false) {
  const streams = await fetchChurchLivestreams(churchId);
  return streams.find((stream) => stream.status === "live")
    ?? streams.filter((stream) => stream.status === "scheduled" && stream.scheduledStart).sort((a, b) => String(a.scheduledStart).localeCompare(String(b.scheduledStart)))[0]
    ?? (includeRecording ? streams.find((stream) => stream.status === "ended" && stream.recordingUrl) : undefined)
    ?? null;
}

export async function fetchMemberLivestreamById(churchId: string, streamId: string) {
  const { data, error } = await supabase
    .from("church_livestreams")
    .select("*")
    .eq("church_id", churchId)
    .eq("id", streamId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeChurchLivestream(data) : null;
}

export async function transitionChurchLivestream(id: string, status: "live" | "ended" | "cancelled") {
  const { data, error } = await supabase.rpc("transition_church_livestream" as never, { _livestream_id: id, _new_status: status } as never);
  if (error) throw error;
  return normalizeChurchLivestream(data as unknown as LivestreamRow);
}

export function isSecureLivestreamUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && YOUTUBE_ID.test(value);
}

export function extractYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else {
        const [kind, candidate] = url.pathname.split("/").filter(Boolean);
        if (["live", "embed", "shorts"].includes(kind)) id = candidate ?? null;
      }
    }
    return id && YOUTUBE_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(stream: ChurchLivestream) {
  if (stream.provider !== "youtube" || !isValidYouTubeVideoId(stream.providerExternalId)) return null;
  return `https://www.youtube.com/embed/${stream.providerExternalId}`;
}

export function getValidatedYouTubeWatchUrl(stream: ChurchLivestream) {
  if (stream.provider !== "youtube" || !isValidYouTubeVideoId(stream.providerExternalId)) return null;
  return extractYouTubeVideoId(stream.watchUrl) === stream.providerExternalId ? stream.watchUrl : null;
}
