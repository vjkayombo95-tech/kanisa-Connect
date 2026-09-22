import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { STAFF_MOBILE_CONFIGS } from "@/lib/staff-mobile-registry";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Wave23D parish office services", () => {
  const adminPage = read("src/pages/church-admin/EventRequestsPage.tsx");
  const memberPage = read("src/pages/portal/EventRequests.tsx");
  const myParish = read("src/pages/portal/MemberMyParishPage.tsx");
  const migration = read("supabase/migrations/20260922120000_fix_event_request_staff_rls.sql");
  const rlsTest = read("supabase/tests/event_requests_rls_hardening.sql");

  it("uses helper-only staff event request RLS without direct permission table joins", () => {
    expect(migration).toContain("public.has_event_request_staff_permission");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("grant execute on function public.has_event_request_staff_permission");
    expect(migration).toContain("crp.role = lower(ur.role::text)");
    expect(migration).toContain("lower(coalesce(ur.role::text, '')) <> 'member'");
    expect(migration).toContain("to_jsonb(pf) ->> 'staff_available'");
    expect(migration).toContain("'event_requests'");
    expect(migration).toContain("'view'");
    expect(migration).toContain("'edit'");
    expect(migration).toContain("'approve'");
    expect(migration).not.toMatch(/create policy[\s\S]*from\s+public\.(user_roles|church_role_permissions|platform_features)/i);
    expect(migration).not.toMatch(/grant\s+select/i);
    expect(rlsTest).toContain("revoke select on public.church_role_permissions from authenticated");
    expect(rlsTest).toContain("authenticated has no direct SELECT on church_role_permissions");
    expect(rlsTest).toContain("view-only staff can read church event request");
    expect(rlsTest).toContain("edit-only staff can update review notes");
    expect(rlsTest).toContain("approve-only staff can perform approval transition");
    expect(rlsTest).toContain("disabled feature blocks staff read permission");
  });

  it("exposes Huduma za Ofisi through existing event_requests feature gating", () => {
    const service = STAFF_MOBILE_CONFIGS.admin.services.find((item) => item.id === "event-requests");
    expect(service).toMatchObject({
      label: "Huduma za Ofisi",
      route: "/church-admin/event-requests",
      featureKey: "event_requests",
    });
  });

  it("keeps admin reads broad and reports errors instead of showing an empty inbox", () => {
    expect(adminPage).toContain('.from("event_requests")');
    expect(adminPage).toContain('.eq("church_id", churchId)');
    expect(adminPage).not.toContain('.eq("request_type"');
    expect(adminPage).not.toContain('.eq("type"');
    expect(adminPage).not.toContain('if (error) return []');
    expect(adminPage).toContain("if (error) throw error");
    expect(adminPage).toContain("isError");
    expect(adminPage).toContain("error_title");
  });

  it("treats submitted office requests as actionable without hiding office service types", () => {
    expect(adminPage).toContain('const NEW_STATUSES = new Set(["pending", "submitted"])');
    expect(adminPage).toContain('status: "under_review"');
    for (const value of ["wedding", "baptism", "funeral", "requested_event", "other_office_service"]) {
      expect(`${adminPage}\n${memberPage}`).toContain(value);
    }
  });

  it("preselects only validated member service query values", () => {
    for (const link of [
      "/portal/event-requests?service=wedding",
      "/portal/event-requests?service=baptism",
      "/portal/event-requests?service=funeral",
      "/portal/event-requests?service=requested_event",
      "/portal/event-requests?service=other",
    ]) {
      expect(myParish).toContain(link);
    }
    expect(myParish).toContain('to="/portal/event-requests"');
    expect(memberPage).toContain("SERVICE_KEYS.includes(value as ServiceKey)");
    expect(memberPage).toContain("getServiceFromSearch(location.search)");
    expect(memberPage).toContain("SERVICE_MAPPING[values.event_type as ServiceKey]");
    expect(memberPage).toContain('throw new Error("Invalid service type")');
  });
});
