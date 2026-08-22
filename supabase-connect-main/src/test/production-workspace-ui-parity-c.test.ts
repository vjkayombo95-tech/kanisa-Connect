import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Production workspace UI parity C boundaries", () => {
  const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");
  const sidebar = read("src/components/church-admin/ChurchAdminSidebar.tsx");
  const command = read("src/components/church-admin/ChurchAdminCommandMenu.tsx");
  const routes = read("src/routes/AdminRoutes.tsx");

  it("uses the compact grouped shell and production-approved registry", () => {
    expect(sidebar).toContain("Church Admin Workspace");
    expect(sidebar).toContain("useVisibleStaffServices(STAFF_MOBILE_CONFIGS.admin)");
    expect(sidebar).toContain("groups.map");
    expect(layout).toContain("ChurchAdminCommandMenu");
    expect(layout).toContain("pageTitle");
  });

  it("communicates expired access without bypassing feature decisions", () => {
    expect(sidebar).toContain("billing.isExpired");
    expect(sidebar).toContain("Workspace access limited");
    expect(sidebar).not.toContain("getFeatureState");
  });

  it("keeps search limited to visible production services", () => {
    expect(command).toContain("useVisibleStaffServices(STAFF_MOBILE_CONFIGS.admin)");
    expect(command).toContain("Ctrl K");
    expect(command).not.toMatch(/operations|audio-processing|preview-member|finance-intelligence/);
  });

  it("does not add staging-only route topology", () => {
    expect(routes).not.toContain("WorkspaceRouteLayout");
    expect(routes).not.toMatch(/path="(operations|audio|preview-member|finance-intelligence|kanisa-ai)"/);
  });
});
