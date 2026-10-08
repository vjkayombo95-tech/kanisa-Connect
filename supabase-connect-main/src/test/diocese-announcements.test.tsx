import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Diocese announcements Slice 5A contract", () => {
  const migration = read(
    "supabase/migrations/20261011120000_diocese_announcements.sql",
  );
  const securityTest = read(
    "supabase/tests/diocese_announcements_security.sql",
  );
  const publishHardeningMigration = read(
    "supabase/migrations/20261014120000_harden_diocese_announcement_publish_targets.sql",
  );
  const service = read("src/lib/diocese-announcements.ts");
  const parishService = read("src/lib/diocese-workspace.ts");
  const page = read("src/pages/diocese/DioceseAnnouncementsPage.tsx");
  const routes = read("src/routes/DioceseRoutes.tsx");
  const authContext = read("src/contexts/AuthContext.tsx");
  const sw = JSON.parse(read("src/locales/sw.json"));
  const en = JSON.parse(read("src/locales/en.json"));

  it("creates a separate Diocese announcement schema and never uses church announcements storage", () => {
    expect(migration).toContain("create table public.diocese_announcements");
    expect(migration).toContain(
      "create table public.diocese_announcement_parish_targets",
    );
    expect(migration).toContain(
      "diocese_announcements_status_check",
    );
    expect(migration).toContain(
      "check (status in ('draft', 'published', 'archived'))",
    );
    expect(migration).toContain(
      "check (target_mode in ('all_parishes', 'selected_parishes'))",
    );

    const dioceseSources = [migration, service, page].join("\n");
    expect(dioceseSources).not.toContain("save_church_announcement");
    expect(dioceseSources).not.toContain("get_portal_announcements");
    expect(dioceseSources).not.toContain('from("announcements")');
    expect(dioceseSources).not.toContain("insert into public.announcements");
    expect(dioceseSources).not.toContain("update public.announcements");
    expect(dioceseSources).not.toContain("delete from public.announcements");
  });

  it("exposes caller-authorized Diocese RPCs with fixed search paths and grants", () => {
    expect(migration).toContain(
      "create function public.get_diocese_announcements",
    );
    expect(migration).toContain(
      "create function public.save_diocese_announcement",
    );
    expect(migration).toContain(
      "create function public.publish_diocese_announcement",
    );
    expect(migration).toContain(
      "create function public.archive_diocese_announcement",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain(
      "public.current_user_can_view_diocese(_diocese_id)",
    );
    expect(migration).toContain(
      "public.current_user_can_manage_diocese(_diocese_id)",
    );
    expect(migration).not.toContain(
      "create or replace function public.current_user_can_manage_diocese",
    );
    expect(migration).toContain(
      "grant execute on function public.get_diocese_announcements(uuid)",
    );
    expect(migration).toContain(
      "grant execute on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[])",
    );
  });

  it("validates selected parish targets against active Diocese parish relationships", () => {
    expect(migration).toContain(
      "validate_diocese_announcement_parish_target",
    );
    expect(migration).toContain("dc.diocese_id = new.diocese_id");
    expect(migration).toContain("dc.church_id = new.church_id");
    expect(migration).toContain("dc.status = 'active'");
    expect(migration).toContain("v_target_mode = 'selected_parishes'");
    expect(migration).toContain("All selected parishes must be active");

    expect(securityTest).toContain(
      "Selected active parish in the same Diocese succeeds",
    );
    expect(securityTest).toContain(
      "Parish belonging to another Diocese is rejected",
    );
    expect(securityTest).toContain(
      "Inactive Diocese-parish link is rejected",
    );
    expect(securityTest).toContain(
      "Cross-Diocese target row cannot be inserted directly",
    );
  });

  it("revalidates selected parish targets when publishing stale drafts", () => {
    expect(publishHardeningMigration).toContain(
      "create or replace function public.publish_diocese_announcement",
    );
    expect(publishHardeningMigration).toContain(
      "create or replace function public.save_diocese_announcement",
    );
    expect(publishHardeningMigration).toContain(
      "public.current_user_can_manage_diocese(_diocese_id)",
    );
    expect(publishHardeningMigration).toContain(
      "v_announcement.target_mode = 'selected_parishes'",
    );
    expect(publishHardeningMigration).toContain(
      "create or replace function public.lock_diocese_announcement_target_mutation",
    );
    expect(publishHardeningMigration).toContain(
      "before insert or update or delete on public.diocese_announcement_parish_targets",
    );
    expect(publishHardeningMigration).toContain(
      "pg_advisory_xact_lock",
    );
    expect(publishHardeningMigration).toContain(
      "diocese_announcement_targets:",
    );
    expect(publishHardeningMigration).toContain(
      "if _announcement_id is not null then",
    );
    expect(publishHardeningMigration).toMatch(
      /if _announcement_id is not null then[\s\S]*pg_advisory_xact_lock[\s\S]*if v_title = '' then/,
    );
    expect(publishHardeningMigration).toMatch(
      /public\.current_user_can_manage_diocese\(_diocese_id\)[\s\S]*pg_advisory_xact_lock[\s\S]*select da\.id, da\.status, da\.target_mode/,
    );
    expect(publishHardeningMigration).toContain(
      "revoke insert, update, delete on table public.diocese_announcement_parish_targets",
    );
    expect(publishHardeningMigration).toContain(
      "grant select on table public.diocese_announcement_parish_targets",
    );
    expect(publishHardeningMigration).not.toContain(
      "lock table public.diocese_announcement_parish_targets in share mode",
    );
    expect(publishHardeningMigration).toContain(
      "At least one active parish target is required",
    );
    expect(publishHardeningMigration).toContain(
      "All selected parishes must be active in this Diocese",
    );
    expect(publishHardeningMigration).toContain(
      "order by dat.church_id asc, dat.id asc",
    );
    expect(publishHardeningMigration).toContain(
      "for update of dat",
    );
    expect(publishHardeningMigration).toContain(
      "order by dc.church_id asc, dc.id asc",
    );
    expect(publishHardeningMigration).toContain("for update of dc");

    expect(securityTest).toContain(
      "Publish selected-parishes announcement with active Diocese-parish target succeeds",
    );
    expect(securityTest).toContain(
      "Publish selected-parishes announcement rejects a target whose Diocese link later ended",
    );
    expect(securityTest).toContain(
      "Publish selected-parishes announcement rejects an empty selected target set",
    );
    expect(securityTest).toContain(
      "Publish all-parishes announcement does not require selected parish targets",
    );
    expect(securityTest).toContain(
      "Ordinary Diocese viewer cannot publish announcements",
    );
  });

  it("routes the Diocese announcements path to the real page", () => {
    expect(routes).toContain(
      'import { DioceseAnnouncementsPage } from "@/pages/diocese/DioceseAnnouncementsPage";',
    );
    expect(routes).toMatch(
      /path="announcements"[\s\S]*element=\{<DioceseAnnouncementsPage\s*\/>\}/,
    );

    const announcementsRoute = routes.slice(
      routes.indexOf('path="announcements"'),
      routes.indexOf('path="events"'),
    );

    expect(announcementsRoute).not.toContain("DiocesePlaceholderPage");
  });

  it("uses only the URL-bound Diocese workspace id for ownership and RPC calls", () => {
    expect(page).toContain("useDioceseWorkspace");
    expect(page).toContain(
      'queryKey: ["diocese-announcements", workspace.diocese_id]',
    );
    expect(page).toContain(
      "getDioceseAnnouncements(workspace.diocese_id)",
    );
    expect(page).toContain("dioceseId: workspace.diocese_id");
    expect(service).toContain('"get_diocese_announcements" as never');
    expect(service).toContain('"save_diocese_announcement" as never');
    expect(service).toContain("_diocese_id: input.dioceseId");

    const dioceseSources = [service, page].join("\n");
    expect(dioceseSources).not.toContain("useAuth");
    expect(dioceseSources).not.toContain("churchId");
    expect(dioceseSources).not.toContain("activeChurchId");
    expect(dioceseSources).not.toContain("switchChurch");
    expect(authContext).not.toContain("activeDioceseId");
  });

  it("supports all-parish and selected-parish targeting from the Diocese parish directory", () => {
    expect(page).toContain("getDioceseParishes");
    expect(page).toContain(
      'queryKey: ["diocese-parishes", workspace.diocese_id]',
    );
    expect(page).toContain("getDioceseParishes(workspace.diocese_id)");
    expect(parishService).toContain('"get_diocese_parishes" as never');
    expect(page).toContain('targetMode: "all_parishes"');
    expect(page).toContain('value="all_parishes"');
    expect(page).toContain('value="selected_parishes"');
    expect(page).toContain("targetChurchIds");
  });

  it("keeps archived Diocese announcements read-only without a restore path", () => {
    expect(page).toContain('announcement.status !== "archived"');
    expect(page).toMatch(
      /announcement\.status !== "archived"[\s\S]*openEditComposer\(announcement\)/,
    );
    expect(page).not.toContain("Restore");
    expect(page).not.toContain("restore");

    expect(migration).toContain(
      "Archived Diocese announcements cannot be edited",
    );
    expect(migration).toContain("and da.status <> 'archived'");
    expect(securityTest).toContain(
      "Archived Diocese announcements cannot be edited through save RPC",
    );
    expect(securityTest).toContain(
      "Archived Diocese announcement remains archived after rejected save",
    );
  });

  it("keeps member delivery, parish admin navigation, and church authority semantics deferred", () => {
    const dioceseSources = [service, page, routes].join("\n");
    const forbidden = [
      "member_id",
      "members",
      "push",
      "sms",
      "email",
      "notification",
      "/church-admin",
      "Open Parish Admin",
      "church_memberships",
      "user_roles",
      "contributions",
      "get_portal_announcements",
      "save_church_announcement",
    ];

    for (const value of forbidden) {
      expect(dioceseSources).not.toContain(value);
    }
  });

  it("localizes loading, error, empty, lifecycle, actions, and audience states", () => {
    const swAnnouncements = sw.diocese_workspace.pages.announcements;
    const enAnnouncements = en.diocese_workspace.pages.announcements;

    expect(swAnnouncements.title).toBe("Matangazo");
    expect(swAnnouncements.new).toBeTruthy();
    expect(swAnnouncements.loading).toBeTruthy();
    expect(swAnnouncements.error.title).toBeTruthy();
    expect(swAnnouncements.empty.title).toBeTruthy();
    expect(swAnnouncements.status.draft).toBeTruthy();
    expect(swAnnouncements.status.published).toBeTruthy();
    expect(swAnnouncements.status.archived).toBeTruthy();
    expect(swAnnouncements.audience.all_parishes).toBeTruthy();
    expect(swAnnouncements.audience.selected_parishes).toBeTruthy();
    expect(swAnnouncements.actions.save_draft).toBeTruthy();
    expect(swAnnouncements.actions.publish).toBeTruthy();

    expect(enAnnouncements.title).toBe("Announcements");
    expect(Object.keys(enAnnouncements.status).sort()).toEqual(
      Object.keys(swAnnouncements.status).sort(),
    );
    expect(Object.keys(enAnnouncements.actions).sort()).toEqual(
      Object.keys(swAnnouncements.actions).sort(),
    );
  });

  it("covers the requested SQL security contract", () => {
    const requiredSignals = [
      "Diocese A manager can create and read Diocese A draft",
      "Diocese A manager cannot read Diocese B announcements",
      "Diocese A manager cannot create Diocese B announcements",
      "Inactive Diocese staff cannot manage announcements",
      "Ordinary Diocese viewer cannot create announcements",
      "Ordinary parish admin does not gain Diocese announcement management",
      "Diocese staff remains non-admin for parish church",
      "Creating Diocese announcements creates zero Diocese-staff user_roles",
      "Creating Diocese announcements creates zero church_memberships",
      "authenticated can execute intended public Diocese announcement RPCs",
      "anon cannot execute management RPCs",
      "authenticated still cannot directly execute internal is_diocese_staff",
      "Archive action cannot cross Diocese boundaries",
      "Direct table DML cannot bypass RLS",
    ];

    for (const signal of requiredSignals) {
      expect(securityTest).toContain(signal);
    }
  });
});
