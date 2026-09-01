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
    expect(services).toContain("presentationGroups");
    expect(services).toContain("groupedServices.map");
  });

  it("renders Zaidi as a calm grouped secondary navigation hub", () => {
    expect(services).toContain("<h1");
    expect(services).toContain("Zaidi");
    expect(services).toContain("Pata huduma na maeneo mengine ya Kanisa Connect.");
    expect(services).toContain('label: "Huduma za Parokia"');
    expect(services).toContain('label: "Kiroho"');
    expect(services).toContain('label: "Media"');
    expect(services).toContain('label: "Akaunti / Nyingine"');
    expect(services).toContain("rounded-[22px]");
    expect(services).toContain("min-h-[68px]");
  });

  it("omits redundant primary entries and preserves ordinary-member restrictions", () => {
    expect(services).toContain('const OMITTED_ZAIDI_SERVICE_IDS = new Set(["home", "services", "today", "my-parish"]);');
    expect(services).toContain("!OMITTED_ZAIDI_SERVICE_IDS.has(item.id)");
    expect(services).toContain("if (!item.ordinaryMemberAllowed) return false;");
    expect(registry).not.toContain('path: "/portal/channels", label:');
    expect(registry).not.toContain('path: "/portal/community-help", label:');
    expect(registry).not.toContain('path: "/portal/event-requests", label:');
  });

  it("keeps feature gating after eligibility and search cannot reveal hidden services", () => {
    expect(services).toContain("if (!item.featureKey) return true;");
    expect(services).toContain("if (item.requiresExplicitChurchEnable) return isFeatureExplicitlyEnabledForChurch(item.featureKey);");
    expect(services).toContain("return (!item.requiresExistingFeature || state.exists) && state.visible;");
    expect(services).toContain("const filtered = query ? visibleServices.filter");
    expect(services).toContain("normalizeSearch(`${item.label} ${item.description}`).includes(query)");
  });

  it("keeps livestream dynamic and never exposes a generic livestream destination", () => {
    expect(services).toContain("const livestreamService = useMemo<MemberServiceDefinition | null>");
    expect(services).toContain("path: `/portal/live/${stream.id}`");
    expect(services).toContain("showInServices: true");
    expect(services).toContain("!presentation(stream) || !getYouTubeEmbedUrl(stream)");
    expect(services).not.toContain('to="/portal/live"');
    expect(services).not.toContain('path: "/portal/live", showInServices: true');
  });

  it("keeps mobile-friendly single-column services structure without touching PortalLayout", () => {
    expect(services).toContain("max-w-4xl");
    expect(services).toContain("space-y-5");
    expect(services).toContain("overflow-x-hidden");
    expect(services).toContain("<ServiceRows items={group.items} />");
    expect(services).not.toContain("grid-cols-");
  });
});
