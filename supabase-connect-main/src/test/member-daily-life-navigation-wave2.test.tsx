import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Wave 2 daily-life discovery", () => {
  const routes = read("routes/MemberRoutes.tsx");
  const home = read("components/portal/MobileMemberHome.tsx");
  const services = read("pages/portal/MemberServicesPage.tsx");
  const registry = read("lib/member-service-registry.ts");
  const layout = read("components/portal/PortalLayout.tsx");
  const appLink = read("components/AppLink.tsx");

  it("registers protected nested routes and exposes them consistently", () => {
    expect(routes).toContain('path="today"');
    expect(routes).toContain('path="my-parish"');
    for (const route of ["/portal/today", "/portal/my-parish"]) {
      expect(home).toContain(`to="${route}"`);
      expect(registry).toContain(`path: "${route}"`);
      expect(layout).toContain(`url: "${route}"`);
      expect(layout).toContain("isOrdinaryMemberPathAllowed");
    }
  });

  it("preserves the four primary actions and unchanged five-item bottom nav", () => {
    expect((home.match(/id: "(?:give|mass|announcements|history)"/g) ?? [])).toHaveLength(4);
    expect(layout).toContain('style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}');
    expect(layout).not.toContain('["/portal", "/portal/today"');
  });

  it("keeps internal discovery SPA-native for persistent media", () => {
    expect(appLink).toContain("navigate(`${url.pathname}${url.search}${url.hash}`)");
    expect(home).toContain("<AppLink");
    expect(services).toContain("<AppLink");
    expect(routes).toContain("<RadioPlayerProvider>");
    expect(routes).toContain("<PersistentLivestreamProvider>");
  });
});
