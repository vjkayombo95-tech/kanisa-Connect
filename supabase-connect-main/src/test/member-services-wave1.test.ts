import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { memberServiceRegistry } from "@/lib/member-service-registry";

const services = readFileSync(join(process.cwd(), "src/pages/portal/MemberServicesPage.tsx"), "utf8");
const registry = readFileSync(join(process.cwd(), "src/lib/member-service-registry.ts"), "utf8");
const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");

describe("production Wave 1 member services", () => {
  it("links only routes backed by the production member router", () => {
    const destinations = memberServiceRegistry.filter((item) => item.showInServices).map((item) => item.path);
    const routePaths = [...routes.matchAll(/path="([^"]+)"/g)].map((match) => `/portal/${match[1]}`);
    const aliases = new Set(["/member/library"]);

    for (const destination of destinations) {
      expect(routePaths.includes(destination) || aliases.has(destination), destination).toBe(true);
    }
  });

  it("adds the tenant-gated member ministry service without exposing larger staging workspaces", () => {
    expect(registry).toContain('path: "/portal/ministries"');
    expect(registry).toContain('featureKey: "ministries"');
    expect(registry).toContain("requiresExistingFeature: true");
    expect(registry).toContain('path: "/portal/kanisa-ai"');
    expect(registry).toContain('requiresExplicitChurchEnable: true');
    expect(registry).toContain('path: "/portal/radio"');
    expect(registry).toContain('featureKey: "radio"');
  });

  it("supports feature visibility, local search, and simplified intent groups", () => {
    expect(services).toContain("state.visible");
    expect(services).toContain('placeholder="Tafuta huduma..."');
    expect(services).toContain("normalizeSearch");
    expect(services).toContain("memberServiceGroups.map");
  });
});
