import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(process.cwd(), "src/components/portal/PortalLayout.tsx"), "utf8");
const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");

describe("member desktop sidebar Wave 1", () => {
  it("renders one desktop sidebar and removes the crowded desktop horizontal nav", () => {
    expect(layout).toContain('data-testid="member-desktop-sidebar"');
    expect(layout).toContain('aria-label="Member desktop navigation"');
    expect(layout).toContain("lg:flex lg:flex-col");
    expect(layout).not.toContain('<nav className="hidden items-center gap-2 lg:flex">');
    expect(layout).not.toContain("<DesktopNavLink");
    expect(layout).not.toContain("<DesktopGroup");
  });

  it("keeps the approved desktop groups and existing member routes", () => {
    for (const label of ["Primary", "Huduma", "Kiroho", "Media"]) {
      expect(layout).toContain(`label: "${label}"`);
    }

    for (const route of [
      "/portal",
      "/portal/today",
      "/portal/my-parish",
      "/portal/give",
      "/portal/mass-intentions",
      "/portal/calendar",
      "/portal/announcements",
      "/portal/ministries",
      "/portal/bible",
      "/portal/daily-readings",
      "/portal/prayers",
      "/portal/sermons",
      "/portal/radio",
    ]) {
      expect(layout).toContain(`url: "${route}"`);
    }

    expect(routes).toContain('path="radio"');
    expect(routes).toContain('path="live/:streamId"');
  });

  it("preserves feature gating and omits a dead generic livestream link", () => {
    expect(layout).toContain("visibleDesktopSidebarGroups");
    expect(layout).toContain("!item.featureKey || getFeatureState(item.featureKey).visible");
    expect(layout).toContain('featureKey: "give"');
    expect(layout).toContain('featureKey: "mass_intentions"');
    expect(layout).toContain('featureKey: "events"');
    expect(layout).toContain('featureKey: "announcements"');
    expect(layout).toContain('featureKey: "ministries"');
    expect(layout).toContain('featureKey: "sermons"');
    expect(layout).toContain('featureKey: "radio"');
    expect(layout).not.toContain('url: "/portal/live"');
  });

  it("supports collapsed and expanded accessible sidebar states", () => {
    expect(layout).toContain("desktopSidebarCollapsed");
    expect(layout).toContain("desktopExpandedGroups");
    expect(layout).toContain('data-collapsed={collapsed ? "true" : "false"}');
    expect(layout).toContain('collapsed ? "w-[5.25rem]" : "w-60"');
    expect(layout).toContain('aria-label={collapsed ? "Expand member sidebar" : "Collapse member sidebar"}');
    expect(layout).toContain("aria-label={collapsed ? label : undefined}");
    expect(layout).toContain("title={collapsed ? label : undefined}");
    expect(layout).toContain('data-active={active ? "true" : "false"}');
  });

  it("keeps the visual polish compact without blocking sidebar scrolling", () => {
    expect(layout).toContain("[scrollbar-width:none]");
    expect(layout).toContain("[-ms-overflow-style:none]");
    expect(layout).toContain("[&::-webkit-scrollbar]:hidden");
    expect(layout).toContain("overflow-y-auto");
    expect(layout).toContain("space-y-2");
    expect(layout).toContain("text-[10px]");
    expect(layout).not.toContain("{!collapsed ? <span>Collapse</span> : null}");

    const toggleIndex = layout.indexOf('aria-label={collapsed ? "Expand member sidebar" : "Collapse member sidebar"}');
    const navIndex = layout.indexOf('aria-label="Member desktop navigation"');
    expect(toggleIndex).toBeGreaterThan(0);
    expect(toggleIndex).toBeLessThan(navIndex);
  });

  it("keeps desktop sidebar and main content scrolling independent", () => {
    expect(layout).toContain('className="flex min-w-0 flex-1 lg:h-[calc(100vh-4rem)] lg:overflow-hidden"');
    expect(layout).toContain('className="min-w-0 flex-1 lg:h-full lg:overflow-y-auto"');
    expect(layout).toContain("h-[calc(100vh-4rem)]");
  });

  it("keeps Primary open and makes secondary groups collapsible by local state", () => {
    expect(layout).toContain('const [desktopExpandedGroups, setDesktopExpandedGroups] = useState<string[]>([]);');
    expect(layout).toContain('const primaryGroup = group.id === "primary";');
    expect(layout).toContain("const groupOpen = collapsed || primaryGroup || activeWithin || expandedGroups.includes(group.id);");
    expect(layout).toContain("aria-expanded={groupOpen}");
    expect(layout).toContain("onClick={() => toggleGroup(group.id)}");
    expect(layout).toContain("current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]");
    expect(layout).toContain('<ChevronRight className="h-3.5 w-3.5 shrink-0" />');
  });

  it("auto-expands active secondary routes and hides text group headers in collapsed mode", () => {
    expect(layout).toContain("activeWithin || expandedGroups.includes(group.id)");
    expect(layout).toContain("{!collapsed && primaryGroup ?");
    expect(layout).toContain("{!collapsed && !primaryGroup ?");
    expect(layout).toContain("collapsed || primaryGroup");
    expect(layout).toContain("group.items.some((item) => isActive(pathname, item.url))");
  });

  it("keeps the existing mobile bottom navigation contract unchanged", () => {
    expect(layout).toContain('style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}');
    expect(layout).toContain('["/portal", "/portal/give", "/portal/mass-intentions", "/portal/announcements", "/portal/services"]');
    expect(layout).toContain("lg:hidden");
  });
});
