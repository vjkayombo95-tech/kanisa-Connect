import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("RC-7.1 audio security trust boundary", () => {
  const migration = read("supabase/migrations/20260708133000_rc71_audio_security_trust_boundary.sql");
  const audioCms = read("supabase/functions/audio-cms/index.ts");
  const audioWorker = read("supabase/functions/audio-worker/index.ts");
  const memberAudio = read("supabase/functions/member-audio/index.ts");
  const memberClient = read("src/lib/member-audio.ts");
  const audioClient = read("src/lib/audio-cms.ts");

  it("blocks direct browser mutation of worker-owned execution fields", () => {
    expect(migration).toContain("protect_audio_job_execution_fields");
    expect(migration).toContain("audio job execution fields are worker-controlled");
    expect(migration).toContain("worker_update_audio_job");
    expect(audioClient).toContain("Audio job execution fields are worker-controlled");
  });

  it("keeps worker progress behind service credentials and a worker secret", () => {
    expect(audioWorker).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(audioWorker).toContain("AUDIO_WORKER_SECRET");
    expect(audioWorker).toContain("x-worker-secret");
    expect(migration).toContain("worker credentials required");
  });

  it("removes browser progress tracking from audio-cms", () => {
    expect(audioCms).not.toContain("track_progress");
    expect(audioCms).toContain("create_upload_url");
    expect(audioCms).toContain(".eq(\"church_id\", churchId)");
    expect(audioCms).toContain("Audio job is not accepting uploads.");
  });

  it("requires reviewer and publisher roles for sensitive workflow actions", () => {
    expect(migration).toContain("has_audio_reviewer_role");
    expect(migration).toContain("has_audio_publisher_role");
    expect(migration).toContain("audio reviewer role required");
    expect(migration).toContain("audio publisher role required");
  });

  it("makes approval transactional and separate from publishing", () => {
    expect(migration).toContain("approve_audio_review");
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("publish_audio_version");
    expect(migration).toContain("status = 'published'");
  });

  it("routes member playback through an edge function and published-only lookup", () => {
    expect(memberClient).toContain("supabase.functions.invoke(\"member-audio\"");
    expect(memberClient).not.toContain(".from(\"audio_jobs\"");
    expect(memberClient).not.toContain(".from(\"audio_versions\"");
    expect(memberAudio).toContain("get_published_audio_lookup");
    expect(memberAudio).toContain("createSignedUrl(version.audio_url, 60 * 30)");
  });
});
