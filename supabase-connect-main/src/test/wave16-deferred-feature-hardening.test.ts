import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isOrdinaryMemberPathAllowed, memberServiceRegistry } from "@/lib/member-service-registry";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const portalLayout = read("src/components/portal/PortalLayout.tsx");
const portalDashboard = read("src/pages/portal/PortalDashboard.tsx");
const eventRequests = read("src/pages/portal/EventRequests.tsx");
const eventWorkflowMigration = read("supabase/migrations/20260704133000_member_event_request_workflow.sql");
const communityHelpMigration = read("supabase/migrations/20260914120000_harden_community_help_request_select_rls.sql");
const communityHelpSqlTest = read("supabase/tests/community_help_requests_rls_hardening.sql");

describe("Wave 16 deferred member feature hardening", () => {
  it("allows Event Requests for ordinary members while keeping Community Help deferred", () => {
    expect(isOrdinaryMemberPathAllowed("/portal/event-requests")).toBe(true);
    expect(isOrdinaryMemberPathAllowed("/member/event-requests")).toBe(true);

    const eventRequestService = memberServiceRegistry.find((item) => item.path === "/portal/event-requests");
    expect(eventRequestService).toBeDefined();
    expect(eventRequestService?.featureKey).toBe("event_requests");
    expect(eventRequestService?.ordinaryMemberAllowed).toBe(true);
    expect(eventRequestService?.showInServices).toBe(false);

    for (const path of ["/portal/community-help", "/member/community-help"]) {
      expect(isOrdinaryMemberPathAllowed(path), path).toBe(false);
    }

    expect(memberServiceRegistry.some((item) => item.path === "/portal/community-help")).toBe(false);

    expect(portalLayout).toContain("isOrdinaryMemberPathAllowed(location.pathname)");
    expect(portalLayout).toContain("simpleMemberRouteHidden || explicitFeatureUnavailable");
  });

  it("does not expose deferred Community Help from Historia Yangu dashboard quick actions", () => {
    expect(portalDashboard).not.toContain("useMemberHelpRequests");
    expect(portalDashboard).not.toContain('to="/portal/community-help"');
    expect(portalDashboard).not.toContain('label="Omba Msaada"');
  });

  it("uses the canonical Event Requests workflow for parish office services", () => {
    expect(eventRequests).toContain('<SelectItem value="wedding">');
    expect(eventRequests).toContain('<SelectItem value="baptism">');
    expect(eventRequests).toContain('<SelectItem value="funeral">');
    expect(eventRequests).toContain('<SelectItem value="requested_event">');
    expect(eventRequests).toContain('requestType: "parish_event"');
    expect(eventRequests).toContain('type: "wedding"');
    expect(eventRequests).toContain('type: "baptism"');
    expect(eventRequests).toContain('type: "funeral"');
    expect(eventRequests).toContain('type: "requested_event"');
    expect(eventRequests).toContain('type: "other_office_service"');
    expect(eventRequests).toContain('status: "submitted"');
    expect(eventRequests).not.toContain('status: "pending"');

    expect(eventWorkflowMigration).toContain("'parish_event'");
    expect(eventWorkflowMigration).toContain("'ministry_group_event'");
    expect(eventWorkflowMigration).toContain("'special_mass_request'");
    expect(eventWorkflowMigration).toContain("'submitted'");
    expect(eventWorkflowMigration).not.toMatch(/check \(request_type in \([\s\S]*'wedding'/);
    expect(eventWorkflowMigration).not.toMatch(/check \(status in \([\s\S]*'pending'/);
  });

  it("replaces broad Community Help same-church SELECT with owner, approved, and manager policies", () => {
    expect(communityHelpMigration).toContain('drop policy if exists "Church members can view help requests"');
    expect(communityHelpMigration).toContain('drop policy if exists "help requests same church"');
    expect(communityHelpMigration).toContain('create policy "Members can read own help requests"');
    expect(communityHelpMigration).toContain('create policy "Members can read approved help requests"');
    expect(communityHelpMigration).toContain('create policy "Church managers can read help requests"');
    expect(communityHelpMigration).toContain("status = 'approved'");
    expect(communityHelpMigration).toContain("public.can_manage_church_workspace(auth.uid(), church_id)");
    expect(communityHelpMigration).not.toMatch(/create policy "help requests same church"/i);
    expect(communityHelpMigration).not.toMatch(/create policy "Church members can view help requests"/i);
  });

  it("adds executable RLS coverage for Community Help privacy semantics", () => {
    expect(communityHelpSqlTest).toContain("owner can read own pending help request");
    expect(communityHelpSqlTest).toContain("same-church member cannot read another member pending help request");
    expect(communityHelpSqlTest).toContain("same-church member can read approved help request");
    expect(communityHelpSqlTest).toContain("cross-church member cannot read other church approved help request");
    expect(communityHelpSqlTest).toContain("authorized church manager can read pending help requests");
    expect(communityHelpSqlTest).toContain("overbroad same-church help request select policies are absent");
  });
});

