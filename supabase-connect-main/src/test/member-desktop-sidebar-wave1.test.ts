import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(process.cwd(), "src/components/portal/PortalLayout.tsx"), "utf8");
const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

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
      "/portal/services",
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

  it("adds Zaidi as a standalone desktop sidebar item after collapsible groups", () => {
    const groupDefinition = layout.slice(
      layout.indexOf("const DESKTOP_SIDEBAR_GROUPS"),
      layout.indexOf("const DESKTOP_SIDEBAR_MORE_ITEM"),
    );
    const moreItemDefinition = layout.slice(layout.indexOf("const DESKTOP_SIDEBAR_MORE_ITEM"));

    expect(moreItemDefinition).toContain("const DESKTOP_SIDEBAR_MORE_ITEM: NavItem");
    expect(moreItemDefinition).toContain('titleKey: "Zaidi"');
    expect(moreItemDefinition).toContain('url: "/portal/services"');
    expect(moreItemDefinition).toContain("icon: PortalIcon");
    expect(groupDefinition).not.toContain('url: "/portal/services"');
    expect(layout).toContain("border-t border-border/45 pt-2");
    expect(layout).toContain("item={DESKTOP_SIDEBAR_MORE_ITEM}");
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
    expect(layout).toContain("item={DESKTOP_SIDEBAR_MORE_ITEM}");
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
    expect(layout).toContain('className="member-main-scrollbar min-w-0 flex-1 lg:h-full lg:overflow-y-auto"');
    expect(layout).toContain("h-[calc(100vh-4rem)]");
  });

  it("renders a subtle desktop divider without adding a middle scroll region", () => {
    expect(layout).toContain("border-r border-primary/10");
    expect(layout).toContain("after:absolute after:inset-y-0 after:-right-px after:w-px");
    expect(layout).toContain("after:bg-[linear-gradient(180deg,transparent,rgba(250,204,21,0.22),rgba(148,163,184,0.12),transparent)]");
    expect(layout).toContain("after:content-['']");
    expect(layout).not.toContain('data-testid="member-sidebar-divider"');
  });

  it("uses a real desktop scrollbar utility on the main content scroll owner", () => {
    expect(layout).toContain('className="member-main-scrollbar min-w-0 flex-1 lg:h-full lg:overflow-y-auto"');
    expect(styles).toContain("@media (min-width: 1024px)");
    expect(styles).toContain(".member-main-scrollbar");
    expect(styles).toContain("scrollbar-gutter: stable;");
    expect(styles).toContain("scrollbar-width: thin;");
    expect(styles).toContain("scrollbar-color: hsl(var(--muted-foreground) / 0.5) hsl(var(--background) / 0.45);");
    expect(styles).toContain(".member-main-scrollbar::-webkit-scrollbar");
    expect(styles).toContain("width: 8px;");
    expect(styles).toContain(".member-main-scrollbar::-webkit-scrollbar-thumb");
    expect(styles).toContain("background: hsl(var(--muted-foreground) / 0.42);");
  });

  it("keeps Primary open and lets active secondary groups collapse by local state", () => {
    expect(layout).toContain('const [desktopExpandedGroups, setDesktopExpandedGroups] = useState<string[]>([]);');
    expect(layout).toContain("const [lastDesktopActiveGroup, setLastDesktopActiveGroup] = useState<string | null>(null);");
    expect(layout).toContain('const primaryGroup = group.id === "primary";');
    expect(layout).toContain("const groupOpen = collapsed || primaryGroup || expandedGroups.includes(group.id);");
    expect(layout).not.toContain("const groupOpen = collapsed || primaryGroup || activeWithin || expandedGroups.includes(group.id);");
    expect(layout).toContain("aria-expanded={groupOpen}");
    expect(layout).toContain("onClick={() => toggleGroup(group.id)}");
    expect(layout).toContain("current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]");
    expect(layout).toContain('<ChevronRight className="h-3.5 w-3.5 shrink-0" />');
  });

  it("auto-expands active secondary groups only when the active route group changes", () => {
    expect(layout).toContain("function findDesktopGroupForPath(groups: NavGroup[], pathname: string)");
    expect(layout).toContain('group.id !== "primary"');
    expect(layout).toContain("const activeDesktopGroup = useMemo(");
    expect(layout).toContain("findDesktopGroupForPath(visibleDesktopSidebarGroups, location.pathname)");
    expect(layout).toContain("if (!activeDesktopGroup) {");
    expect(layout).toContain("setLastDesktopActiveGroup(null);");
    expect(layout).toContain("if (activeDesktopGroup === lastDesktopActiveGroup) return;");
    expect(layout).toContain("current.includes(activeDesktopGroup) ? current : [...current, activeDesktopGroup]");
    expect(layout).toContain("setLastDesktopActiveGroup(activeDesktopGroup);");
  });

  it("keeps secondary route groups available for Huduma, Kiroho, and Media", () => {
    expect(layout).toContain("{!collapsed && primaryGroup ?");
    expect(layout).toContain("{!collapsed && !primaryGroup ?");
    expect(layout).toContain("collapsed || primaryGroup");
    expect(layout).toContain("group.items.some((item) => isActive(pathname, item.url))");
    expect(layout).toContain('label: "Huduma"');
    expect(layout).toContain('url: "/portal/give"');
    expect(layout).toContain('label: "Kiroho"');
    expect(layout).toContain('url: "/portal/bible"');
    expect(layout).toContain('label: "Media"');
    expect(layout).toContain('url: "/portal/radio"');
  });

  it("keeps the existing mobile bottom navigation contract unchanged", () => {
    expect(layout).toContain('style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}');
    expect(layout).toContain('["/portal", "/portal/give", "/portal/mass-intentions", "/portal/announcements", "/portal/services"]');
    expect(layout).toContain('{ titleKey: "Zaidi", url: "/portal/services", icon: PortalIcon, featureKey: null }');
    expect(layout).not.toContain('{ titleKey: "Huduma", url: "/portal/services", icon: PortalIcon, featureKey: null }');
    expect(layout).toContain("lg:hidden");
  });
});
