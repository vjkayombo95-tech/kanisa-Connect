import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("RC-7.2 audio performance", () => {
  const migration = read("supabase/migrations/20260708134000_rc72_audio_performance.sql");
  const hook = read("src/hooks/use-audio-jobs.ts");
  const jobsPage = read("src/pages/church-admin/audio/AudioJobsPage.tsx");
  const dashboard = read("src/pages/church-admin/audio/AudioDashboardPage.tsx");
  const review = read("src/pages/church-admin/audio/AudioReviewPage.tsx");
  const memberAudio = read("supabase/functions/member-audio/index.ts");

  it("uses server-side pagination and dashboard aggregates", () => {
    expect(migration).toContain("list_audio_jobs_page");
    expect(migration).toContain("get_audio_dashboard_summary");
    expect(hook).toContain("listAudioJobs({");
    expect(dashboard).toContain("useAudioDashboard");
    expect(jobsPage).not.toContain(".slice((page - 1) * PAGE_SIZE");
  });

  it("uses realtime as primary refresh with polling fallback only", () => {
    expect(hook).toContain("SUBSCRIBED");
    expect(hook).toContain("CHANNEL_ERROR");
    expect(hook).toContain("refetchInterval: usePollingFallback ? 15000 : false");
    expect(review).toContain("refetchInterval: usePollingFallback ? 15000 : false");
  });

  it("lazy-loads large review artifacts", () => {
    expect(review).toContain("requestedArtifacts.report");
    expect(review).toContain("requestedArtifacts.manifest");
    expect(review).toContain("requestedArtifacts.index");
    expect(review).toContain("Load verse index");
  });

  it("virtualizes jobs and verse review rows", () => {
    expect(jobsPage).toContain("useVirtualRows");
    expect(review).toContain("useVirtualRows");
    expect(review).toContain("VerseReviewRow");
  });

  it("uses indexed member playback lookup", () => {
    expect(migration).toContain("idx_audio_jobs_member_lookup");
    expect(migration).toContain("get_published_audio_lookup");
    expect(memberAudio).toContain("get_published_audio_lookup");
    expect(memberAudio).not.toContain("audio_jobs!inner");
  });
});
