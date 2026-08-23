import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("production member ministry parity", () => {
  const routes = read("routes/MemberRoutes.tsx");
  const services = read("pages/portal/MemberServicesPage.tsx");
  const registry = read("lib/member-service-registry.ts");
  const queries = read("lib/member-ministries.ts");
  const features = read("lib/portal-features.ts");
  const page = read("pages/portal/MemberMinistriesPage.tsx");
  const mobileBack = read("components/portal/MemberMobileBackHeader.tsx");
  const layout = read("components/portal/PortalLayout.tsx");

  it("registers list and detail routes through the existing protected member shell", () => {
    expect(routes).toContain('path="ministries"');
    expect(routes).toContain('path="ministries/:ministryId"');
    expect(registry).toContain('path: "/portal/ministries"');
  });

  it("keeps feature visibility fail closed", () => {
    expect(features).toContain('{ prefix: "/portal/ministries", featureKey: "ministries" }');
    expect(registry).toContain('featureKey: "ministries"');
    expect(registry).toContain("requiresExistingFeature: true");
    expect(layout).toContain('activeFeatureKey === "ministries"');
    expect(layout).toContain("!activeFeatureState?.exists");
  });

  it("scopes reads and join requests to the resolved church and member", () => {
    expect(queries).toContain('.eq("church_id", churchId)');
    expect(queries).toContain('.eq("member_id", memberId)');
    expect(queries).toContain("church_id: churchId");
    expect(queries).toContain("member_id: memberId");
  });

  it("uses the existing production tables without adding a backend contract", () => {
    expect(queries).toContain('.from("ministries")');
    expect(queries).toContain('.from("member_ministries")');
    expect(queries).toContain('.from("ministry_join_requests")');
  });

  it("uses the portal's safe mobile back header without rendering a duplicate", () => {
    expect(mobileBack).toContain('"/portal/ministries": "Huduma za Parokia"');
    expect(mobileBack).toContain("/ministries\\/[^/]+$");
    expect(page).not.toContain("navigate(-1)");
    expect(page).not.toContain("ArrowLeft");
  });

  it("keeps mutations pending until refreshed membership state is available", () => {
    expect(page).toContain("onSuccess: async () =>");
    expect(page).toContain("await queryClient.invalidateQueries");
  });
});
