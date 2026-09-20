import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const migration = read("supabase/migrations/20260920120000_repair_branding_authorization_contract.sql");
const upload = read("src/lib/file-upload.ts");
const dashboardTest = read("src/test/wave21-church-cover-photo.test.ts");

describe("Wave 21 branding storage authorization repair", () => {
  it("keeps branding paths tenant-prefixed for banners and logos", () => {
    expect(upload).toContain('storagePath: (churchId) => `${churchId}/banners/banner`');
    expect(upload).toContain('storagePath: (churchId) => `${churchId}/logos/logo`');
    expect(upload).toContain('bucket: "church-assets"');
  });

  it("repairs only the existing church-assets manager write policies", () => {
    expect(migration).toContain('drop policy if exists "Church managers can upload church assets"');
    expect(migration).toContain('create policy "Church managers can upload church assets"');
    expect(migration).toContain('drop policy if exists "Church managers can update church assets"');
    expect(migration).toContain('create policy "Church managers can update church assets"');
    expect(migration).toContain('drop policy if exists "Church managers can delete church assets"');
    expect(migration).toContain('create policy "Church managers can delete church assets"');
    expect(migration).not.toMatch(/for select/i);
    expect(migration).not.toContain("Public can read church assets");
  });

  it("keeps authenticated writes scoped to church-assets and workspace managers", () => {
    expect(migration).toMatch(/for insert\s+to authenticated/i);
    expect(migration).toMatch(/for update\s+to authenticated/i);
    expect(migration).toMatch(/for delete\s+to authenticated/i);
    expect(migration.match(/bucket_id = 'church-assets'/g)).toHaveLength(4);
    expect(migration).toContain("public.can_manage_church_workspace(auth.uid(), c.id)");
    expect(migration).not.toMatch(/auth\.role\(\)\s*=\s*'authenticated'/);
  });

  it("explicitly compares church id against the evaluated storage object path", () => {
    expect(migration).toContain("where c.id::text = (storage.foldername(storage.objects.name))[1]");
    expect(migration).not.toContain("storage.foldername(name)");
    expect(migration).not.toContain("storage.foldername(c.name)");
  });

  it("does not modify feature-permission tables or replace authorization helpers", () => {
    expect(migration).not.toContain("public.platform_features");
    expect(migration).not.toContain("public.church_features");
    expect(migration).not.toContain("public.church_role_permissions");
    expect(migration).not.toContain("create or replace function public.has_church_feature_permission");
  });

  it("keeps the Wave 21 dashboard banner assertions in place", () => {
    expect(dashboardTest).toContain("bannerUrl: church.data?.banner_url ?? null");
    expect(dashboardTest).toContain('backgroundImage: `url("${bannerUrl}")`');
    expect(dashboardTest).toContain(".update({ banner_url: result.publicUrl })");
  });
});
