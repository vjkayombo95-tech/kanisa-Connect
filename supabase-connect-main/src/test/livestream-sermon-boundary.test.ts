import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { getMemberLivestreamPresentation, type ChurchLivestream } from "@/lib/church-livestreams";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const liveCard = read("src/components/portal/LiveMassCard.tsx");
const liveHook = read("src/hooks/use-church-livestream.ts");
const livestreamPage = read("src/pages/church-admin/LivestreamsPage.tsx");
const sermonPage = read("src/pages/church-admin/SermonsPage.tsx");
const parishPage = read("src/pages/portal/MyParishPage.tsx");
const registry = read("src/components/workspace/registry.ts");
const migration = read("supabase/migrations/20260808150000_publish_livestream_as_sermon.sql");

const stream = (status: ChurchLivestream["status"], recordingUrl: string | null = null): ChurchLivestream => ({
  id: "stream-a", churchId: "church-a", status, title: "Sunday Mass", provider: "youtube",
  watchUrl: "https://example.test/live", recordingUrl, thumbnailUrl: null,
  scheduledStart: "2026-08-09T07:00:00Z", scheduledEnd: null,
  actualStartedAt: status === "ended" || status === "live" ? "2026-08-09T07:02:00Z" : null,
  actualEndedAt: status === "ended" ? "2026-08-09T08:00:00Z" : null,
  providerExternalId: null, providerStatus: null, providerLastCheckedAt: null,
  providerLastErrorCategory: null, statusSource: "manual",
});

describe("livestream and sermon product boundary", () => {
  it("drives member LIVE state only from authoritative livestream status", () => {
    expect(getMemberLivestreamPresentation(stream("live"))).toBe("live");
    expect(getMemberLivestreamPresentation(stream("ended", "https://example.test/recording"))).toBeNull();
    expect(liveCard).not.toContain("sermons");
    expect(liveHook).not.toContain("sermons");
  });

  it("offers conversion only for ended recordings and never substitutes watch_url", () => {
    expect(livestreamPage).toContain('stream.status === "ended" && stream.recordingUrl');
    expect(livestreamPage).toContain("Chapisha kama Hubiri");
    expect(livestreamPage).toContain("recordingUrl: stream.recordingUrl ?? \"\"");
    expect(migration).toContain("v_stream.recording_url");
    expect(migration).not.toMatch(/video_url[\s\S]{0,250}v_stream\.watch_url/);
  });

  it("requires independent permissions and prevents duplicate or cross-church conversion", () => {
    expect(migration).toContain("'livestream', 'view'");
    expect(migration).toContain("'sermons', 'create'");
    expect(migration).toContain("'sermons', 'publish'");
    expect(migration).toContain("sermons_one_per_source_livestream_idx");
    expect(migration).toContain("sermons_source_livestream_same_church_fkey");
  });

  it("keeps historical livestream state unchanged on success or failure", () => {
    expect(migration).not.toMatch(/update\s+public\.church_livestreams/i);
    expect(migration).toContain("Only an ended livestream can be published as a sermon");
    expect(migration).toContain("A recording URL is required");
  });

  it("keeps navigation, terminology, and visual treatment distinct", () => {
    expect(registry).toContain('to: "/church-admin/livestreams"');
    expect(registry).toContain('to: "/church-admin/sermons"');
    expect(sermonPage).not.toContain("Anza LIVE");
    expect(sermonPage).not.toContain('variant="destructive">LIVE');
    expect(parishPage).toContain("RecordedSermonsWidget");
    expect(parishPage).not.toContain("LiveStreamWidget");
  });
});
