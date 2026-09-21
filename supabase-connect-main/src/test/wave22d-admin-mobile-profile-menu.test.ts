import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 22D admin mobile profile menu", () => {
  it("places the mobile profile dropdown in ChurchAdminLayout", () => {
    const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");

    expect(layout).toContain('data-testid="church-admin-mobile-profile-header"');
    expect(layout).toContain("lg:hidden");
    expect(layout).toContain("<DropdownMenuTrigger asChild>");
    expect(layout).toContain('aria-label="Fungua wasifu"');
    expect(layout).toContain("{profile?.full_name || \"Admin\"}");
  });

  it("shows settings through the same route permission check and keeps pastoral and finance excluded by registry", () => {
    const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");
    const registry = read("src/lib/staff-mobile-registry.ts");

    expect(layout).toContain('isStaffRouteAllowed(staffWorkspace, "/church-admin/settings")');
    expect(layout).toContain("canOpenSettings ? (");
    expect(layout).toContain("Mipangilio ya Kanisa");
    expect(registry).toContain('if (workspace === "admin") return pathname === "/church-admin" || pathname.startsWith("/church-admin/");');
    expect(registry).toContain('if (workspace !== "pastoral" && workspace !== "finance") return false;');
    expect(registry).toContain("config.services.some");
    expect(registry).not.toContain('pastoralServices.push({ id: "settings"');
    expect(registry).not.toContain('financeServices.push({ id: "settings"');
  });

  it("uses the existing sign-out flow and LogOut icon for Toka", () => {
    const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");

    expect(layout).toContain("const handleSignOut = async () => {");
    expect(layout).toContain("await signOut();");
    expect(layout).toContain('navigate("/login");');
    expect(layout).toContain("<LogOut");
    expect(layout).toContain("Toka");
    expect(layout).toContain("Sign Out");
  });

  it("removes the Zaidi account section and keeps StaffMobileExperience auth-free", () => {
    const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");
    const servicesPage = read("src/pages/StaffServicesPage.tsx");
    const adminRoutes = read("src/routes/AdminRoutes.tsx");

    expect(mobile).not.toMatch(/signOut|logout|\/login/);
    expect(mobile).not.toContain("StaffMobileAccountAction");
    expect(mobile).not.toContain("Akaunti");
    expect(servicesPage).not.toContain("accountActions");
    expect(servicesPage).toContain("<StaffMobileServices config={config} />");
    expect(adminRoutes).not.toContain("createStaffMobileAccountActions");
    expect(adminRoutes).not.toContain("accountActions");
    expect(adminRoutes).toContain("<StaffServicesPage config={config} />");
  });

  it("preserves community services behavior and the three-item bottom nav", () => {
    const staffRoutes = read("src/routes/StaffRoutes.tsx");
    const mobile = read("src/components/staff-mobile/StaffMobileExperience.tsx");

    expect(staffRoutes).toContain("<StaffServicesPage config={getCommunityMobileConfig(communityId)} />");
    expect(staffRoutes).not.toContain("accountActions");
    expect(mobile).toContain('label: "Nyumbani"');
    expect(mobile).toContain("label: config.workLabel");
    expect(mobile).toContain('label: "Zaidi"');
    expect(mobile).toContain("grid-cols-3");
  });

  it("keeps the desktop admin profile menu intact", () => {
    const layout = read("src/components/church-admin/ChurchAdminLayout.tsx");

    expect(layout).toContain('className="sticky top-0 z-40 hidden h-[76px]');
    expect(layout).toContain("Church Settings");
    expect(layout).toContain("Sign Out");
  });
});
