import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveWorkspacePagePermissions } from "@/components/workspace/page-context";

const migration = readFileSync(
  path.resolve("supabase/migrations/20260722180000_fix_mutation_permission_alignment.sql"),
  "utf8",
);
const eventScopeMigration = readFileSync(
  path.resolve("supabase/migrations/20260722190000_enforce_event_mutation_scope.sql"),
  "utf8",
);
const brandingStorageMigration = readFileSync(
  path.resolve("supabase/migrations/20260722191000_fix_branding_storage_permission_policy.sql"),
  "utf8",
);
const authenticatedTriggerMigration = readFileSync(
  path.resolve("supabase/migrations/20260722210000_enforce_authenticated_trigger_context.sql"),
  "utf8",
);
const settingsPage = readFileSync(path.resolve("src/pages/church-admin/SettingsPage.tsx"), "utf8");

describe("mutation permission alignment", () => {
  it("requires authoritative settings manage permission at RLS and trigger boundaries", () => {
    expect(migration).toContain('create policy "church settings manage update"');
    expect(migration).toContain("as restrictive");
    expect(migration).toContain("enforce_church_settings_manage_permission");
    expect(migration).toContain("'feature_permissions_admin', 'manage'");
    expect(migration).toContain("message_templates_manage_by_permission");
    expect(migration).toContain('create policy "church settings guard asset insert"');
    expect(migration).toContain("raise exception 'Missing manage permission for church settings'");
    expect(brandingStorageMigration).toContain("storage.foldername(name)");
    expect(brandingStorageMigration).toContain("'feature_permissions_admin', 'manage'");
    expect(brandingStorageMigration).not.toContain("from public.churches");
  });

  it("aligns Event create, edit, and delete policies to Events actions", () => {
    expect(migration).toContain("'events', 'create'");
    expect(migration).toContain("'events', 'edit'");
    expect(migration).toContain("'events', 'delete'");
    expect(migration).not.toContain("can_manage_church_roles(");
    expect(migration).toContain("and (created_by is null or created_by = auth.uid())");
    expect(eventScopeMigration).toContain("created_by = auth.uid()");
    expect(eventScopeMigration).toContain("'events', 'edit'");
    expect(eventScopeMigration).toContain("'events', 'manage'");
    expect(eventScopeMigration).toContain("enforce_event_mutation_scope");
    expect(eventScopeMigration).not.toMatch(/role\s*=|role\s+in\s*\(/i);
  });

  it("aligns Announcement policies and security-definer RPCs to action permissions", () => {
    expect(migration).toContain("'announcements', 'create'");
    expect(migration).toContain("'announcements', 'edit'");
    expect(migration).toContain("'announcements', 'publish'");
    expect(migration).toContain("'announcements', 'delete'");
    expect(migration).toContain("create or replace function public.save_church_announcement");
    expect(migration).toContain("create or replace function public.set_church_announcement_archived");
    expect(migration).toContain("create or replace function public.delete_church_announcement");
    expect(migration).toContain("enforce_announcement_action_permissions");
    expect(migration).toContain("v_content_changed");
    expect(migration).toContain("v_lifecycle_changed");
  });

  it("keeps tenant and actor fields immutable for Events and Announcements", () => {
    expect(migration).toContain("enforce_tenant_actor_immutability");
    expect(migration).toContain("new.church_id is distinct from old.church_id");
    expect(migration).toContain("new.created_by is distinct from old.created_by");
    expect(
      authenticatedTriggerMigration.match(
        /session_user in \('postgres', 'supabase_admin'\) and auth\.uid\(\) is null/g,
      ),
    ).toHaveLength(4);
    expect(authenticatedTriggerMigration).toContain("auth.role() = 'service_role'");
    expect(authenticatedTriggerMigration).toContain("enforce_announcement_action_permissions");
    expect(authenticatedTriggerMigration).toContain("enforce_event_mutation_scope");
  });

  it("lets authoritative Pastor permissions expose create without changing workspace defaults", () => {
    expect(resolveWorkspacePagePermissions("pastoral", false).has("create")).toBe(false);
    const permissions = resolveWorkspacePagePermissions("pastoral", true, { read: true, create: true });
    expect(permissions).toEqual(new Set(["read", "create"]));
  });

  it("guards every Settings page mutation entry point in the client", () => {
    expect(settingsPage).toContain('useChurchPermission("feature_permissions_admin", "manage")');
    expect(settingsPage.match(/if \(!settingsPermission\.allowed\)/g)).toHaveLength(6);
    expect(settingsPage).toContain("churchId && settingsPermission.allowed");
  });
});
