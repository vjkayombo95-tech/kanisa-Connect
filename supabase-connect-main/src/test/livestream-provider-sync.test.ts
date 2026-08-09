import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { extractYouTubeVideoId, fetchYouTubeStatus, normalizeYouTubeVideo, providerTransition } from "../../supabase/functions/_shared/livestream-provider";
import { hasVerifiedServiceRole } from "../../supabase/functions/_shared/verified-service-role";
import { extractYouTubeVideoId as extractBrowserYouTubeVideoId } from "@/lib/church-livestreams";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260809120000_livestream_provider_status_sync.sql");
const worker = read("supabase/functions/sync-livestream-status/index.ts");
const supabaseConfig = read("supabase/config.toml");
const memberCard = read("src/components/portal/LiveMassCard.tsx");
const memberHook = read("src/hooks/use-church-livestream.ts");
const sermonMigration = read("supabase/migrations/20260808150000_publish_livestream_as_sermon.sql");

describe("livestream provider synchronization", () => {
  const token = (payload: unknown) => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.synthetic-signature`;
  };

  it("authorizes only a gateway-verified service_role claim", () => {
    expect(hasVerifiedServiceRole(`Bearer ${token({ role: "service_role" })}`)).toBe(true);
    expect(hasVerifiedServiceRole(`Bearer ${token({ role: "authenticated" })}`)).toBe(false);
    expect(hasVerifiedServiceRole(`Bearer ${token({ role: "anon" })}`)).toBe(false);
  });

  it("fails closed for missing and malformed authorization", () => {
    expect(hasVerifiedServiceRole(null)).toBe(false);
    expect(hasVerifiedServiceRole("")).toBe(false);
    expect(hasVerifiedServiceRole("not-a-jwt")).toBe(false);
    expect(hasVerifiedServiceRole("Bearer")).toBe(false);
    expect(hasVerifiedServiceRole(`Bearer ${token({ role: "service_role" })} extra`)).toBe(false);
    expect(hasVerifiedServiceRole("Bearer malformed.jwt")).toBe(false);
    expect(hasVerifiedServiceRole("Basic credentials")).toBe(false);
    expect(hasVerifiedServiceRole(`Bearer ${token({})}`)).toBe(false);
    expect(hasVerifiedServiceRole("Bearer !!!.@@@.signature")).toBe(false);
  });

  it.each([
    ["https://www.youtube.com/watch?v=abc123DEF45", "abc123DEF45"],
    ["https://youtu.be/abc123DEF45?t=3", "abc123DEF45"],
    ["https://youtube.com/live/abc123DEF45", "abc123DEF45"],
  ])("extracts supported YouTube identifiers", (url, id) => {
    expect(extractYouTubeVideoId(url)).toBe(id);
    expect(extractBrowserYouTubeVideoId(url)).toBe(id);
  });

  it("rejects malformed or non-YouTube URLs", () => {
    for (const value of ["https://youtube.com/live/short", "https://example.com/watch?v=abc123DEF45", "not-a-url"]) {
      expect(extractYouTubeVideoId(value)).toBeNull();
      expect(extractBrowserYouTubeVideoId(value)).toBeNull();
    }
  });

  it("normalizes scheduled, live, ended, and unknown provider states", () => {
    expect(normalizeYouTubeVideo({ snippet: { liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: "2026-08-09T08:00:00Z" } }, "abc123DEF45").status).toBe("scheduled");
    expect(normalizeYouTubeVideo({ snippet: { liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-08-09T08:01:00Z" } }, "abc123DEF45")).toMatchObject({ status: "live", actualStartedAt: "2026-08-09T08:01:00Z" });
    expect(normalizeYouTubeVideo({ liveStreamingDetails: { actualEndTime: "2026-08-09T09:00:00Z" } }, "abc123DEF45")).toMatchObject({ status: "ended", actualEndedAt: "2026-08-09T09:00:00Z" });
    expect(normalizeYouTubeVideo(null, "abc123DEF45").status).toBe("unknown");
  });

  it("fails conservatively for provider errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(fetchYouTubeStatus("abc123DEF45", "server-secret", fetcher)).resolves.toMatchObject({ status: "unknown", errorCategory: "rate_limited" });
  });

  it("allows only provider-authoritative forward transitions", () => {
    expect(providerTransition("scheduled", "scheduled")).toBeNull();
    expect(providerTransition("scheduled", "live")).toBe("live");
    expect(providerTransition("live", "live")).toBeNull();
    expect(providerTransition("live", "ended")).toBe("ended");
    expect(providerTransition("live", "scheduled")).toBeNull();
    expect(providerTransition("ended", "live")).toBeNull();
    expect(providerTransition("cancelled", "live")).toBeNull();
    expect(providerTransition("live", "unknown")).toBeNull();
  });

  it("uses tenant-explicit bounded service synchronization", () => {
    expect(migration).toContain("where id = _livestream_id and church_id = _church_id for update");
    expect(migration).toContain("is_service_feature_available(_church_id, 'livestream')");
    expect(worker).toContain('.in("status", ["scheduled", "live"])');
    expect(worker).toContain('.limit(25)');
    expect(worker).toContain('isServiceFeatureAvailable(db, stream.church_id, "livestream")');
    expect(worker).not.toContain("VITE_YOUTUBE");
    expect(worker).not.toContain("supplied !== serviceKey");
    expect(supabaseConfig).toContain("[functions.sync-livestream-status]\nverify_jwt = true");
  });

  it("keeps manual, member, and sermon boundaries unchanged", () => {
    expect(migration).toContain("else ''manual'' end");
    expect(memberCard).not.toContain("youtube/v3");
    expect(memberHook).not.toContain("youtube");
    expect(sermonMigration).toContain("v_stream.recording_url");
    expect(sermonMigration).toContain("Only an ended livestream can be published as a sermon");
  });
});
