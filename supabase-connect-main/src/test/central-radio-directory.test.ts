import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSafeRadioStreamUrl } from "@/lib/church-radio";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260810140000_centralize_radio_station_directory.sql").replace(/\r\n/g, "\n");
const privilegeRepair = read("supabase/migrations/20260810150000_repair_radio_station_column_privileges.sql");
const rollout = read("supabase/migrations/20260810120000_add_church_live_radio.sql");
const library = read("src/lib/church-radio.ts");
const churchPage = read("src/pages/church-admin/RadioStationsPage.tsx");
const superPage = read("src/pages/super-admin/RadioDirectoryPage.tsx");
const routes = read("src/routes/SuperAdminRoutes.tsx");
const registry = read("src/components/workspace/registry.ts");
const player = read("src/contexts/RadioPlayerContext.tsx");

describe("central Radio directory", () => {
  it("migrates existing endpoints into one platform catalogue without editing rollout history", () => {
    expect(migration).toContain("create table public.radio_stations");
    expect(migration).toContain("select distinct on (stream_url)");
    expect(migration).toContain("stream_format, metadata_url");
    expect(migration).toContain("metadata_url text check (metadata_url is null or public.is_safe_public_https_url(metadata_url))");
    expect(migration).toContain("set radio_station_id = station.id");
    expect(migration).toContain("enabled = selection.is_active");
    expect(migration).toContain("alter column radio_station_id set not null");
    expect(migration).toContain("drop column stream_url");
    expect(migration).toContain("unique index church_radio_stations_church_station_idx");
    expect(migration).toContain("array_agg(id order by is_featured desc, id::text)");
    expect(migration).toContain("selection.id <> grouped.keep_id");
    expect(migration).not.toContain("min(id::text)::uuid as keep_id");
    expect(rollout).toContain("church_radio_stations_one_featured_idx");
  });

  it("makes technical catalogue writes Super Admin-only", () => {
    expect(migration).toContain('policy "Super admins manage platform radio directory"');
    expect(migration).toContain("public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())");
    expect(superPage).toContain("Stream URL");
    expect(superPage).toContain("Metadata URL (optional)");
    expect(superPage).toContain("metadataUrl: form.metadataUrl || null");
    expect(library).toContain('client.rpc("get_platform_radio_stations")');
    expect(library).toContain("metadata_url: station.metadataUrl || null");
    expect(superPage).toContain("Test Stream");
    expect(superPage).toContain("new Audio(station.streamUrl)");
    expect(superPage).toContain('audio.preload = "none"');
  });

  it("removes broad catalogue reads while preserving playback columns", () => {
    expect(privilegeRepair).toContain("revoke select on table public.radio_stations from anon, authenticated");
    expect(privilegeRepair).toContain("stream_format, is_active, is_approved, health_status");
    expect(privilegeRepair).not.toMatch(/grant select[\s\S]*metadata_url/i);
    expect(privilegeRepair).not.toContain("revoke insert");
    expect(privilegeRepair).not.toContain("revoke update");
    expect(privilegeRepair).not.toContain("revoke delete");
  });

  it("limits Church Admin to approved own-church selections", () => {
    expect(migration).toContain("set_church_radio_selection");
    expect(migration).toContain("has_church_feature_permission(\n    auth.uid(), _church_id, 'radio', 'manage'");
    expect(migration).toContain("Only approved Radio stations may be selected");
    expect(churchPage).not.toContain("Stream URL");
    expect(churchPage).not.toContain("streamUrl");
    expect(churchPage).not.toContain("provider");
    expect(churchPage).not.toContain("metadataUrl");
    expect(churchPage).not.toContain("Metadata URL");
    expect(migration).toContain("Platform Radio directory permission required");
    expect(churchPage).toContain("setChurchRadioSelection");
    expect(library).toContain('.eq("is_approved", true)');
    expect(registry).toContain('to: "/church-admin/radio", icon: Radio, featureFlag: "radio", requireFeatureEnabled: true');
    expect(churchPage).toContain('useChurchPermission("radio", "manage")');
  });

  it("resolves member selections through approved active central metadata", () => {
    expect(library).toContain("radio_stations(${platformColumns})");
    expect(library).not.toContain("radio_stations(${platformAdminColumns})");
    expect(library).toContain("!station.is_active || !station.is_approved");
    expect(library).toContain('eq("enabled", true)');
    expect(library).toContain("streamUrl: row.stream_url");
  });

  it("keeps metadata lookup optional and outside member playback", () => {
    expect(library).toContain("metadataUrl: row.metadata_url ?? null");
    expect(player).not.toContain("metadataUrl");
    expect(player).not.toContain("metadata_url");
    expect(churchPage).not.toContain("metadata_url");
  });

  it("keeps secure normal stream endpoints and rejects unsafe targets", () => {
    expect(isSafeRadioStreamUrl("https://dreamsiteradiocp2.com/proxy/rmtanzania2?mp=/stream")).toBe(true);
    for (const url of ["javascript:alert(1)", "data:audio/mpeg,x", "file:///tmp/radio", "https://localhost/live", "https://127.0.0.1/live", "https://10.0.0.1/live", "https://169.254.1.2/live"]) expect(isSafeRadioStreamUrl(url)).toBe(false);
  });

  it("registers the Super Admin directory route and navigation", () => {
    expect(routes).toContain('path="radio" element={<RadioDirectoryPage />}');
    expect(registry).toContain('to: "/super-admin/radio"');
  });

  it("preserves provider-to-browser persistent playback", () => {
    expect(player).toContain("new Audio(next.streamUrl)");
    expect(player).toContain("audioRef.current?.pause()");
    expect(player).toContain('data-testid="radio-mini-player"');
    expect(migration).toContain("Stream bytes never transit Supabase");
    expect(migration).not.toContain("storage.objects");
  });
});
