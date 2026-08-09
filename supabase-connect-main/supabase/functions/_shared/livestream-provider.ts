export type LivestreamProviderStatus = "scheduled" | "live" | "ended" | "cancelled" | "unknown";

export type LivestreamProviderResult = {
  provider: "youtube";
  providerExternalId: string;
  status: LivestreamProviderStatus;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  recordingUrl: string | null;
  thumbnailUrl: string | null;
  checkedAt: string;
  errorCategory: string | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate: string | null = null;
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v");
      else {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (kind === "live" || kind === "embed" || kind === "shorts") candidate = id ?? null;
      }
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

type YouTubeVideo = {
  snippet?: { liveBroadcastContent?: string; thumbnails?: Record<string, { url?: string }> };
  liveStreamingDetails?: { scheduledStartTime?: string; actualStartTime?: string; actualEndTime?: string };
};

function thumbnail(video: YouTubeVideo): string | null {
  const values = video.snippet?.thumbnails;
  return values?.maxres?.url ?? values?.standard?.url ?? values?.high?.url ?? values?.medium?.url ?? values?.default?.url ?? null;
}

export function normalizeYouTubeVideo(video: YouTubeVideo | null, externalId: string, checkedAt = new Date().toISOString()): LivestreamProviderResult {
  const details = video?.liveStreamingDetails;
  let status: LivestreamProviderStatus = "unknown";
  if (details?.actualEndTime) status = "ended";
  else if (video?.snippet?.liveBroadcastContent === "live" || details?.actualStartTime) status = "live";
  else if (video?.snippet?.liveBroadcastContent === "upcoming" || details?.scheduledStartTime) status = "scheduled";
  return {
    provider: "youtube", providerExternalId: externalId, status,
    actualStartedAt: details?.actualStartTime ?? null,
    actualEndedAt: details?.actualEndTime ?? null,
    recordingUrl: null,
    thumbnailUrl: video ? thumbnail(video) : null,
    checkedAt,
    errorCategory: video ? null : "provider_unknown",
  };
}

export async function fetchYouTubeStatus(externalId: string, apiKey: string, fetcher: FetchLike = fetch): Promise<LivestreamProviderResult> {
  const checkedAt = new Date().toISOString();
  if (!YOUTUBE_ID.test(externalId)) return { ...normalizeYouTubeVideo(null, externalId, checkedAt), errorCategory: "invalid_external_id" };
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,liveStreamingDetails,status");
    url.searchParams.set("id", externalId);
    url.searchParams.set("key", apiKey);
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      ...(fetcher === fetch ? { signal: AbortSignal.timeout(10_000) } : {}),
    });
    if (!response.ok) {
      const category = response.status === 429 ? "rate_limited" : response.status === 401 || response.status === 403 ? "provider_auth" : response.status >= 500 ? "provider_temporary" : "provider_unknown";
      return { ...normalizeYouTubeVideo(null, externalId, checkedAt), errorCategory: category };
    }
    const payload = await response.json() as { items?: YouTubeVideo[] };
    return normalizeYouTubeVideo(payload.items?.[0] ?? null, externalId, checkedAt);
  } catch {
    return { ...normalizeYouTubeVideo(null, externalId, checkedAt), errorCategory: "provider_temporary" };
  }
}

export function providerTransition(current: "scheduled" | "live" | "ended" | "cancelled", provider: LivestreamProviderStatus) {
  if (current === "scheduled" && provider === "live") return "live" as const;
  if (current === "live" && provider === "ended") return "ended" as const;
  return null;
}
