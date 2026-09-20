import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const migration = read("supabase/migrations/20260920120000_repair_branding_authorization_contract.sql");
const storagePolicy = read("supabase/migrations/20260722191000_fix_branding_storage_permission_policy.sql");
const settingsAlignment = read("supabase/migrations/20260722180000_fix_mutation_permission_alignment.sql");
const upload = read("src/lib/file-upload.ts");
const dashboardTest = read("src/test/wave21-church-cover-photo.test.ts");

describe("Wave 21 branding storage authorization repair", () => {
  it("keeps branding paths tenant-prefixed for banners and logos", () => {
    expect(upload).toContain('storagePath: (churchId) => `${churchId}/banners/banner`');
    expect(upload).toContain('storagePath: (churchId) => `${churchId}/logos/logo`');
    expect(upload).toContain('bucket: "church-assets"');
  });

  it("preserves storage RLS tenant isolation instead of broad authenticated uploads", () => {
    expect(storagePolicy).toContain("bucket_id = 'church-assets'");
    expect(storagePolicy).toContain("coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')");
    expect(storagePolicy).toContain("(storage.foldername(name))[1] ~*");
    expect(storagePolicy).toContain("((storage.foldername(name))[1])::uuid");
    expect(storagePolicy).toContain("'feature_permissions_admin', 'manage'");
    expect(storagePolicy).not.toMatch(/auth\.role\(\)\s*=\s*'authenticated'/);
  });

  it("keeps the restrictive branding guard aligned with the permissive branding policies", () => {
    expect(storagePolicy).toContain('create policy "church settings guard asset insert"');
    expect(storagePolicy).toContain("on storage.objects as restrictive for insert to authenticated");
    expect(storagePolicy).toContain('create policy "church settings guard asset update"');
    expect(storagePolicy).toContain('create policy "church settings guard asset delete"');
  });

  it("uses the same canonical predicate for church settings updates and branding storage", () => {
    expect(settingsAlignment).toContain('create policy "church settings manage update"');
    expect(settingsAlignment).toContain("public.has_church_feature_permission(auth.uid(), id, 'feature_permissions_admin', 'manage')");
    expect(storagePolicy).toContain("public.has_church_feature_permission(");
  });

  it("repairs mandatory Church Admin recovery rows for all churches", () => {
    expect(migration).toContain("pf.key = 'feature_permissions_admin'");
    expect(migration).toContain("insert into public.church_features");
    expect(migration).toContain("enabled = true");
    expect(migration).toContain("locked = true");
    expect(migration).toContain("insert into public.church_role_permissions");
    expect(migration).toContain("select c.id, 'church_admin', pf.id, true, true");
  });

  it("restores multi-role effective authorization after the production-specific override", () => {
    expect(migration).toContain("create or replace function public.has_church_feature_permission");
    expect(migration).toContain("exists (\n          select 1\n          from public.user_roles ur");
    expect(migration).toContain("lower(ur.role::text) = 'church_admin'");
    expect(migration).toContain("lower(ur.role::text) = crp.role");
    expect(migration).toContain("crp.role = 'member'");
    expect(migration).not.toContain("ur.user_id = _user_id and ur.church_id = _church_id\n        and pf.key = _feature_key");
  });

  it("does not grant pastoral, finance, anonymous, or non-branding storage authority", () => {
    expect(migration).not.toMatch(/role in \('church_admin','pastor'\)/);
    expect(migration).not.toMatch(/role in \('church_admin','pastor','secretary','treasurer'\)/);
    expect(migration).not.toMatch(/grant execute[\s\S]*to anon/);
    expect(storagePolicy).toContain("coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')");
  });

  it("keeps the Wave 21 dashboard banner assertions in place", () => {
    expect(dashboardTest).toContain("bannerUrl: church.data?.banner_url ?? null");
    expect(dashboardTest).toContain('backgroundImage: `url("${bannerUrl}")`');
    expect(dashboardTest).toContain(".update({ banner_url: result.publicUrl })");
  });
});
