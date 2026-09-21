import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createStaffMobileAccountActions } from "@/routes/AdminRoutes";
import type { StaffMobileWorkspace } from "@/lib/staff-mobile-role";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

function labelsFor(workspace: StaffMobileWorkspace | null) {
  return createStaffMobileAccountActions({
    workspace,
    signOut: async () => {},
    navigate: vi.fn() as never,
  }).map((action) => action.label);
}

describe("Wave 22C admin mobile account actions", () => {
  it("shows Church Settings and Toka for church admin only", () => {
    expect(labelsFor("admin")).toEqual(["Mipangilio ya Kanisa", "Toka"]);
    expect(labelsFor("pastoral")).toEqual(["Toka"]);
    expect(labelsFor("finance")).toEqual(["Toka"]);
  });

  it("uses the existing sign-out flow before navigating to login", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push("signOut");
    });
    const navigate = vi.fn((to: string) => {
      order.push(`navigate:${to}`);
    });
    const action = createStaffMobileAccountActions({ workspace: "admin", signOut, navigate: navigate as never }).find((item) => item.label === "Toka");

    await action?.onSelect?.();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login");
    expect(order).toEqual(["signOut", "navigate:/login"]);
  });

  it("passes account actions only from the church-admin services route", () => {
    const adminRoutes = read("src/routes/AdminRoutes.tsx");
    const staffRoutes = read("src/routes/StaffRoutes.tsx");

    expect(adminRoutes).toContain("<StaffServicesPage config={config} accountActions={accountActions} />");
    expect(staffRoutes).toContain("<StaffServicesPage config={getCommunityMobileConfig(communityId)} />");
    expect(staffRoutes).not.toContain("accountActions");
  });

  it("keeps the mobile shell presentation-only for auth and preserves a three-item bottom nav", () => {
    const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");

    expect(mobile).not.toMatch(/signOut|logout|\/login/);
    expect(mobile).toContain('label: "Nyumbani"');
    expect(mobile).toContain("label: config.workLabel");
    expect(mobile).toContain('label: "Zaidi"');
    expect(mobile).toContain("grid-cols-3");
  });

  it("renders the mobile account section through optional StaffServicesPage props", () => {
    const servicesPage = read("src/pages/StaffServicesPage.tsx");
    const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");

    expect(servicesPage).toContain("accountActions?: StaffMobileAccountAction[]");
    expect(servicesPage).toContain("<StaffMobileServices config={config} accountActions={accountActions} />");
    expect(mobile).toContain("Akaunti");
    expect(mobile).toContain("min-h-14");
  });
});
