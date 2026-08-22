import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const services = readFileSync(join(process.cwd(), "src/pages/portal/MemberServicesPage.tsx"), "utf8");
const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");

describe("production Wave 1 member services", () => {
  it("links only routes backed by the production member router", () => {
    const destinations = [...services.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]);
    const routePaths = [...routes.matchAll(/path="([^"]+)"/g)].map((match) => `/portal/${match[1]}`);
    const aliases = new Set(["/member/library"]);

    for (const destination of destinations) {
      expect(routePaths.includes(destination) || aliases.has(destination), destination).toBe(true);
    }
  });

  it("adds the tenant-gated member ministry service without exposing larger staging workspaces", () => {
    expect(services).toContain('to: "/portal/ministries"');
    expect(services).toContain('featureKey: "ministries"');
    expect(services).toContain('to: "/portal/kanisa-ai"');
    expect(services).toContain('requiresExplicitChurchEnable: true');
    expect(services).toContain('to: "/portal/radio"');
    expect(services).toContain('featureKey: "radio"');
  });

  it("supports feature visibility, local search, and collapsible sections", () => {
    expect(services).toContain("getFeatureState(item.featureKey).visible");
    expect(services).toContain('placeholder="Tafuta huduma..."');
    expect(services).toContain("normalizeSearch");
    expect(services).toContain("aria-expanded={isExpanded}");
  });
});
