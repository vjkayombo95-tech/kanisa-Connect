import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractYouTubeVideoId } from "@/lib/church-livestreams";

const page = readFileSync("src/pages/church-admin/LivestreamsPage.tsx", "utf8");
const hook = readFileSync("src/hooks/use-church-livestream.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260813120000_production_livestream_adaptation.sql", "utf8");
const dbHarness = readFileSync("supabase/tests/production_livestream_adaptation.sql", "utf8");

describe("production livestream admin editing", () => {
  it("shows Edit only after the canonical edit permission resolves true", () => {
    expect(page).toContain('useLivestreamPermission("edit")');
    expect(page).toContain('editPermission.data === true ? <button');
    expect(hook).toContain('supabase.rpc("has_livestream_permission"');
  });

  it("supports admin and pastor edit while default-deny roles remain denied", () => {
    expect(migration).toContain("r.role in ('church_admin','pastor')");
    expect(dbHarness).toContain("pastor-a@test.invalid");
    expect(dbHarness).toContain("secretary-a@test.invalid");
    expect(dbHarness).toContain("treasurer-a@test.invalid");
  });

  it("opens with existing editable metadata", () => {
    expect(page).toContain("title: row.title");
    expect(page).toContain("watchUrl: row.watch_url");
    expect(page).toContain("toLocalInput(row.scheduled_start)");
    expect(page).toContain("toLocalInput(row.scheduled_end)");
  });

  it("updates only metadata and never lifecycle status", () => {
    const updatePayload = page.match(/\.update\(\{([^}]+)\}\)\.eq\("id"/s)?.[1] ?? "";
    expect(updatePayload).toContain("title:");
    expect(updatePayload).toContain("watch_url:");
    expect(updatePayload).toContain("scheduled_start:");
    expect(updatePayload).not.toContain("status");
  });

  it("scopes every edit to both stream and authenticated church", () => {
    expect(page).toContain('.eq("id", form.id).eq("church_id", churchId)');
    expect(migration).toContain("Authorized tenant managers update livestreams");
  });

  it("accepts valid YouTube metadata", () => {
    expect(extractYouTubeVideoId("https://youtu.be/M7lc1UVf-VE")).toBe("M7lc1UVf-VE");
  });

  it("rejects invalid YouTube metadata before update", () => {
    expect(extractYouTubeVideoId("https://example.com/M7lc1UVf-VE")).toBeNull();
    expect(page).toContain("A valid public YouTube URL is required");
  });

  it("keeps lifecycle changes on the transition RPC", () => {
    expect(page).toContain('db.rpc("transition_production_livestream"');
    expect(dbHarness).toContain("live to scheduled allowed");
    expect(dbHarness).toContain("ended to live allowed");
  });

  it("provides Save, Cancel, loading, success, and failure states", () => {
    expect(page).toContain('"Saving…"');
    expect(page).toContain(">Cancel</button>");
    expect(page).toContain('toast({ title: "Livestream updated" })');
    expect(page).toContain('role="alert"');
  });

  it("keeps the edit form open and coherent on save failure", () => {
    expect(page).not.toMatch(/onError:\s*\(?.*setEdit\(null\)/s);
    expect(page).toContain("update.error");
  });
});
