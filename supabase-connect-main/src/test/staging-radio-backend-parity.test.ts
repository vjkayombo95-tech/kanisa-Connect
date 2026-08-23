import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/20260822120000_align_staging_radio_with_production.sql"),
  "utf8",
).toLowerCase();

describe("staging Radio backend parity migration", () => {
  it("adds the production feature and permission RPC contracts", () => {
    expect(migration).toContain("function public.radio_feature_enabled(_church_id uuid)");
    expect(migration).toContain("function public.has_radio_permission(");
    expect(migration).toContain("has_church_feature_permission(_user_id, _church_id, 'radio', _action)");
  });

  it("preserves featured data while introducing one enabled default per church", () => {
    expect(migration).toContain("add column if not exists is_default boolean not null default false");
    expect(migration).toContain("set is_default = enabled and is_featured");
    expect(migration).toContain("check (is_default = is_featured)");
    expect(migration).toContain("create unique index if not exists church_radio_stations_one_default_idx");
    expect(migration).toContain("where enabled and is_default");
    expect(migration).not.toContain("drop column is_featured");
  });

  it("replaces the conflicting staging RPC with the production named arguments", () => {
    expect(migration).toContain("drop function if exists public.set_church_radio_selection(uuid,uuid,boolean,boolean,integer)");
    expect(migration).toContain("_is_default boolean default false");
    expect(migration).toContain("_is_featured boolean");
    expect(migration).toContain("_legacy_contract text default 'staging-is-featured'");
    expect(migration).toContain("perform public.set_church_radio_selection(");
  });

  it("keeps selection management fail-closed and directory-approved", () => {
    expect(migration).toContain("if not public.has_radio_permission(auth.uid(), _church_id, 'manage')");
    expect(migration).toContain("where id = _radio_station_id and is_active and is_approved");
    expect(migration).toContain("grant select on public.church_radio_stations to authenticated");
    expect(migration).not.toContain("grant select, insert, update, delete on public.church_radio_stations");
  });

  it("uses tenant-scoped member and manager RLS", () => {
    expect(migration).toContain("has_radio_permission(auth.uid(), selection.church_id, 'view')");
    expect(migration).toContain("has_radio_permission(auth.uid(), church_id, 'manage')");
    expect(migration).toContain("enabled and public.has_radio_permission(auth.uid(), church_id, 'view')");
  });
});
