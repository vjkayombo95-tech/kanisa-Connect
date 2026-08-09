import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isSecureLivestreamUrl, normalizeChurchLivestream } from "@/lib/church-livestreams";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260808123000_church_livestream_foundation.sql");
const page = read("src/pages/church-admin/LivestreamsPage.tsx");
const routes = read("src/lib/workspace-route-permissions.ts");
const memberHook = read("src/hooks/use-church-livestream.ts");

describe("authoritative church livestream foundation", () => {
  it("defines the approved schema and provider/status constraints", () => {
    expect(migration).toContain("create table if not exists public.church_livestreams");
    expect(migration).toContain("status in ('scheduled','live','ended','cancelled')");
    expect(migration).toContain("provider in ('youtube','facebook','vimeo','custom')");
    expect(migration).toContain("references public.churches(id) on delete cascade");
  });

  it("uses the existing livestream feature permission for tenant-scoped reads and writes", () => {
    expect(migration).toContain("has_church_feature_permission(auth.uid(), church_id, 'livestream', 'view')");
    expect(migration).toContain("has_church_feature_permission(auth.uid(), church_id, 'livestream', 'create')");
    expect(migration).toContain("has_church_feature_permission(auth.uid(), church_id, 'livestream', 'edit')");
    expect(routes).toContain('featureKey: "livestream", action: "manage"');
  });

  it("allows only explicit forward lifecycle transitions", () => {
    expect(migration).toContain("old.status = 'scheduled' and new.status in ('live','cancelled')");
    expect(migration).toContain("old.status = 'live' and new.status in ('ended','cancelled')");
    expect(migration).not.toContain("old.status = 'ended' and new.status = 'live'");
  });

  it("sets authoritative timestamps and prevents two live streams", () => {
    expect(migration).toContain("new.actual_started_at := clock_timestamp()");
    expect(migration).toContain("new.actual_ended_at := clock_timestamp()");
    expect(migration).toContain("where status = 'live'");
  });

  it("audits lifecycle changes and attributes actors", () => {
    expect(migration).toContain("public.create_audit_log");
    expect(migration).toContain("previous_status");
    expect(migration).toContain("updated_by := auth.uid()");
  });

  it("requires secure web URLs", () => {
    expect(isSecureLivestreamUrl("https://youtube.com/live/abc")).toBe(true);
    expect(isSecureLivestreamUrl("http://example.com/live")).toBe(false);
    expect(isSecureLivestreamUrl("javascript:alert(1)")).toBe(false);
  });

  it("normalizes the database row without provider coupling", () => {
    const stream = normalizeChurchLivestream({ id: "s1", church_id: "c1", status: "live", title: "Misa", provider: "custom", watch_url: "https://example.com/live", scheduled_start: null, scheduled_end: null, actual_started_at: "2026-08-08T08:00:00Z", actual_ended_at: null, recording_url: null, thumbnail_url: null, provider_external_id: null, provider_status: null, provider_last_checked_at: null, provider_next_sync_at: null, provider_failure_count: 0, provider_last_error_category: null, status_source: "manual", created_by: null, updated_by: null, created_at: "2026-08-08T08:00:00Z", updated_at: "2026-08-08T08:00:00Z" });
    expect(stream).toMatchObject({ churchId: "c1", status: "live", provider: "custom" });
  });

  it("provides explicit create, start, end, cancel, and recording controls", () => {
    expect(page).toContain("Ratibu livestream");
    expect(page).toContain("Uko tayari kuonyesha kwamba Misa hii inaendelea moja kwa moja?");
    expect(page).toContain("Unataka kumaliza matangazo ya moja kwa moja?");
    expect(page).toContain('status: "cancelled"');
    expect(page).toContain('id="recording-url"');
  });

  it("hides management controls without authoritative manage permission", () => {
    expect(page).toContain('useChurchPermission("livestream", "manage")');
    expect(page).toContain("if (!canManage)");
  });

  it("does not query when the existing livestream feature is unavailable", () => {
    expect(memberHook).toContain('getFeatureState("livestream")');
    expect(memberHook).toContain("enabled: !!churchId && !featureLoading && feature.visible");
    expect(memberHook).toContain("refetchIntervalInBackground: false");
  });
});
