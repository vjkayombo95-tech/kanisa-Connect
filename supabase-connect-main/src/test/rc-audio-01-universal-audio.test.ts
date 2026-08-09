import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260708140000_rc_audio_01_universal_audio_platform.sql"),
  "utf8",
);
const service = readFileSync(path.join(root, "src/lib/universal-audio.ts"), "utf8");
const hooks = readFileSync(path.join(root, "src/hooks/use-universal-audio.ts"), "utf8");
const types = readFileSync(path.join(root, "src/types/universal-audio.ts"), "utf8");

describe("RC-AUDIO-01 universal audio foundation", () => {
  it("creates the generic universal audio tables", () => {
    expect(migration).toContain("create table if not exists public.audio_content");
    expect(migration).toContain("create table if not exists public.audio_tracks");
    expect(migration).toContain("create table if not exists public.audio_progress");
    expect(migration).toContain("create table if not exists public.audio_bookmarks");
    expect(migration).toContain("create table if not exists public.audio_history");
  });

  it("enforces RLS and member-safe access boundaries", () => {
    expect(migration).toContain("alter table public.audio_content enable row level security");
    expect(migration).toContain("public.can_access_audio_content");
    expect(migration).toContain("public.is_active_church_member");
    expect(migration).toContain("Users can manage own audio progress");
    expect(migration).toContain("Users can manage own audio bookmarks");
    expect(migration).toContain("Users can append own audio history");
  });

  it("seeds John 3 from existing published audio without hard-coding Bible-only schema", () => {
    expect(migration).toContain("external_ref = 'bible:JHN:3'");
    expect(migration).toContain("from public.audio_versions av");
    expect(migration).toContain("join public.audio_jobs aj");
    expect(migration).toContain("'bible_chapter'");
  });

  it("exposes generic service APIs and hooks", () => {
    expect(service).toContain("loadAudioContent");
    expect(service).toContain("loadAudioTracks");
    expect(service).toContain("saveAudioProgress");
    expect(service).toContain("createAudioBookmark");
    expect(service).toContain("recordAudioHistory");
    expect(hooks).toContain("useAudioContent");
    expect(hooks).toContain("useAudioTracks");
    expect(hooks).toContain("useSaveAudioProgress");
    expect(types).toContain("UniversalAudioContentType");
    expect(types).toContain("UniversalAudioHistoryEvent");
  });
});
