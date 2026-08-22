import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 3 production integration boundaries", () => {
  const auth = read("src/contexts/AuthContext.tsx");
  const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");
  const adminLayout = read("src/components/church-admin/ChurchAdminLayout.tsx");

  it("reads only authenticated current-church role rows and clears presentation on logout", () => {
    expect(auth).toContain('.from("user_roles")');
    expect(auth).toContain('.eq("user_id",target.id).eq("church_id",contextData.church_id)');
    expect(auth).toContain("setUserRoles([])");
    expect(auth).toContain("setStaffWorkspace(null)");
  });

  it("does not use the generic permission RPC for normal services", () => {
    expect(mobile).not.toContain("has_church_feature_permission");
    expect(mobile).toContain('useLivestreamPermission("manage")');
    expect(mobile).toContain("getFeatureState");
  });

  it("keeps desktop content mounted and scopes mobile presentation to lg:hidden", () => {
    const dashboard = read("src/pages/church-admin/ChurchDashboard.tsx");
    const mobileDashboard = read("src/components/church-admin/ChurchDashboardMobileExperience.tsx");
    expect(dashboard).toContain('className="hidden space-y-8 lg:block"');
    expect(mobileDashboard).toContain('className="space-y-7 lg:hidden"');
    expect(mobile).toContain("lg:hidden");
  });

  it("implements searchable, collapsible and touch-sized controls", () => {
    expect(mobile).toContain("Tafuta huduma");
    expect(mobile).toContain("aria-expanded");
    expect(mobile).toContain("min-h-12");
    expect(mobile).toContain("min-h-14");
  });

  it("uses safe workspace-contained back navigation without history traversal", () => {
    expect(mobile).toContain("stateFrom.startsWith(root)");
    expect(mobile).toContain("navigate(target, { replace: true })");
    expect(mobile).not.toContain("navigate(-1)");
  });
});
