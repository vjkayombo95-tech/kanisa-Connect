import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const roleMobile = read("src/components/workspace/RoleMobileExperience.tsx");
const framework = read("src/components/workspace/framework.tsx");
const community = read("src/components/community-leader/CommunityMobileExperience.tsx");

describe("role-based mobile experiences", () => {
  it("keeps role-specific work destinations and the shared home/services navigation", () => {
    for (const label of ["Wanachama", "Nia", "Michango", "Makanisa"]) expect(roleMobile).toContain(`workLabel: "${label}"`);
    expect(roleMobile).toContain('{ label: "Nyumbani", to: root');
    expect(roleMobile).toContain('{ label: "Zaidi", to: `${root}/services`');
    expect(framework).toContain("getRoleMobileNavigation(workspace, visibleGroups)");
  });

  it("derives mobile actions and navigation from permission-filtered items", () => {
    expect(framework).toContain("useVisibleNavigationGroups(workspace.navigation)");
    expect(framework).toContain("useVisibleNavigationItems(workspace.quickActions ?? [])");
    expect(framework).toContain("visibleQuickActions={visibleQuickActions}");
  });

  it("provides a separate community leader home, services directory, and bottom navigation", () => {
    for (const exportName of ["CommunityMobileHome", "CommunityMobileServices", "CommunityMobileBottomNav"]) {
      expect(community).toContain(`export function ${exportName}`);
    }
    for (const label of ["Nyumbani", "Wanachama", "Zaidi"]) expect(community).toContain(`label: "${label}"`);
    expect(community).toContain("min-h-14");
    expect(community).toContain("lg:hidden");
  });
});
