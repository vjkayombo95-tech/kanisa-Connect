import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim().toLowerCase();

const baseline = read("supabase/migrations/20260622000000_production_baseline.sql");
const foundation = read("supabase/migrations/20260728120000_create_church_memberships_foundation.sql");
const readHelpers = read("supabase/migrations/20260729120000_add_canonical_membership_read_helpers.sql");
const migration = read("supabase/migrations/20261004120000_allow_multi_church_member_records.sql");
const normalizedMigration = normalize(migration);

describe("multi-church membership slice 1 database contract", () => {
  it("documents and replaces the legacy one-user-one-member index", () => {
    expect(baseline).toContain(
      "CREATE UNIQUE INDEX unique_user_member ON public.members USING btree (user_id) WHERE (user_id IS NOT NULL);",
    );

    expect(normalizedMigration).toContain("drop index if exists public.unique_user_member");
    expect(normalizedMigration).toContain("create unique index if not exists members_user_church_unique_idx");
    expect(normalizedMigration).toContain("on public.members (user_id, church_id)");
    expect(normalizedMigration).toContain("where user_id is not null and church_id is not null");
  });

  it("allows the same user to have one member identity in each church without allowing duplicates in one church", () => {
    expect(normalizedMigration).toContain("group by m.user_id, m.church_id having count(*) > 1");
    expect(normalizedMigration).toContain("duplicate linked member rows exist");
    expect(normalizedMigration).not.toContain("unique index unique_user_member");
  });

  it("preserves unlinked member records and different users in the same church", () => {
    expect(normalizedMigration).toContain("where user_id is not null and church_id is not null");
    expect(normalizedMigration).not.toMatch(/alter table public\.members\s+alter column user_id set not null/i);
    expect(normalizedMigration).not.toMatch(/alter table public\.members\s+alter column church_id set not null/i);
    expect(normalizedMigration).not.toContain("delete from public.members");
  });

  it("keeps canonical membership uniqueness and primary invariants enforced by the foundation", () => {
    expect(foundation).toContain("constraint church_memberships_user_church_key unique (user_id, church_id)");
    expect(foundation).toContain("constraint church_memberships_primary_active_check");
    expect(foundation).toContain("check (not is_primary or status = 'active')");
    expect(foundation).toContain("create unique index church_memberships_one_active_primary_user_idx");
    expect(foundation).toContain("where is_primary and status = 'active'");
  });

  it("backfills canonical memberships and links members and roles without activating the draft migration", () => {
    expect(normalizedMigration).toContain("insert into public.church_memberships");
    expect(normalizedMigration).toContain("on conflict (user_id, church_id) do nothing");
    expect(normalizedMigration).toContain("update public.members m set membership_id = cm.id");
    expect(normalizedMigration).toContain("update public.user_roles ur set membership_id = cm.id");
    expect(normalizedMigration).toContain("slice1_member_uniqueness_backfill_v1");
    expect(normalizedMigration).not.toContain("phase2_backfill_v1");
  });

  it("guards membership_id consistency for member and role rows", () => {
    expect(normalizedMigration).toContain("create or replace function public.enforce_member_membership_scope()");
    expect(normalizedMigration).toContain("create trigger enforce_member_membership_scope");
    expect(normalizedMigration).toContain("create or replace function public.enforce_user_role_membership_scope()");
    expect(normalizedMigration).toContain("create trigger enforce_user_role_membership_scope");
    expect(normalizedMigration).toContain("members.membership_id must reference the same user_id and church_id");
    expect(normalizedMigration).toContain("user_roles.membership_id must reference the same user_id and church_id");
  });

  it("does not change the existing auth context, UI, or RLS authorization model", () => {
    expect(normalizedMigration).not.toContain("create or replace function public.get_current_user_context");
    expect(normalizedMigration).not.toContain("drop function if exists public.get_current_user_context");
    expect(normalizedMigration).not.toContain("create policy");
    expect(normalizedMigration).not.toContain("alter policy");
    expect(normalizedMigration).not.toContain("grant select on table public.church_memberships to authenticated");

    expect(read("src/contexts/AuthContext.tsx")).toContain('rpc("get_current_user_context"');
    expect(read("src/components/portal/PortalLayout.tsx")).toContain("function ProfileMenu");
    expect(read("src/components/church-admin/ChurchAdminLayout.tsx")).toContain("export function ChurchAdminLayout()");
    expect(read("src/components/auth/ProtectedRoute.tsx")).toContain("requireAdmin && !isSuperAdmin && !isAdminRole");
  });

  it("leaves canonical membership reads caller-bound and non-authoritative for this slice", () => {
    expect(readHelpers).toContain("Returns only the authenticated caller active canonical memberships");
    expect(readHelpers).toContain("it does not authorize or select a workspace");
    expect(readHelpers).toContain("This output must not replace get_current_user_context");
    expect(readHelpers).toContain("It must never grant, deny, redirect, or select an active church");
  });
});
