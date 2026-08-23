import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/20260823120000_align_staging_livestream_permission_with_production.sql"),
  "utf8",
).toLowerCase();

describe("staging Livestream permission backend parity", () => {
  it("adds the production-compatible RPC signature", () => {
    expect(migration).toContain("function public.has_livestream_permission(");
    expect(migration).toContain("_user_id uuid");
    expect(migration).toContain("_church_id uuid");
    expect(migration).toContain("_action text default 'view'");
  });

  it("delegates to the fail-closed tenant permission engine", () => {
    expect(migration).toContain("has_church_feature_permission(_user_id, _church_id, 'livestream', _action)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
  });

  it("exposes only authenticated execution", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to authenticated");
    expect(migration).not.toMatch(/to anon|to public/);
  });

  it("does not alter grants, feature state, RLS, subscriptions, or data", () => {
    expect(migration).not.toMatch(/church_role_permissions|church_features|platform_features/);
    expect(migration).not.toMatch(/create policy|drop policy|alter policy/);
    expect(migration).not.toMatch(/\b(insert|update|delete|alter table)\b/);
    expect(migration).not.toMatch(/subscription/);
  });
});
