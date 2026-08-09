import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const page = read("src/pages/church-admin/MinistriesPage.tsx");
const hardened = read("supabase/migrations/20260721130000_harden_tenant_feature_permissions.sql");
const repair = read("supabase/migrations/20260808160000_repair_ministries_approve_permission.sql");
const remediation = read("supabase/migrations/20260727130000_remediate_legacy_role_permission_conflicts.sql");

describe("ministry join request authorization", () => {
  it("maps status review to the backend ministries approve permission", () => {
    expect(hardened).toContain("tg_table_name in ('event_requests','ministry_join_requests')");
    expect(hardened).toContain("v_action := 'approve'");
    expect(repair).toContain(
      "if auth.uid() is null and session_user in (''postgres'',''supabase_admin'') then",
    );
  });

  it("repairs the constraint and only provisions Church Admin approve", () => {
    const approveRules = repair.slice(repair.indexOf("when 'approve'"), repair.indexOf("when 'publish'"));

    expect(approveRules).toContain("'ministries'");
    expect(repair).toContain("v_feature = 'ministries' and v_action = 'approve' and v_role <> 'church_admin'");
    expect(repair).toContain("pf.key = 'ministries'");
    expect(repair).toContain("where cf.enabled");
    expect(repair).toContain("'church_admin', v_feature.id, false, false, false, false, true, false, false");
    expect(remediation).toContain("('church_admin','ministries','approve')");
  });

  it("renders review actions only through the existing permission helper", () => {
    expect(page).toContain('useChurchPermission("ministries", "approve")');
    expect(page).toContain("canApproveMinistryRequests ?");
    expect(page).toContain("Approve");
    expect(page).toContain("Reject");
    expect(page).toContain("You do not have permission to review ministry join requests.");
  });
});
