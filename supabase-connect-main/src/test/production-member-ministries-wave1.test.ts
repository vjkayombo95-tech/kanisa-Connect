import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("production member ministry parity", () => {
  const routes = read("routes/MemberRoutes.tsx");
  const services = read("pages/portal/MemberServicesPage.tsx");
  const queries = read("lib/member-ministries.ts");
  const features = read("lib/portal-features.ts");

  it("registers list and detail routes through the existing protected member shell", () => {
    expect(routes).toContain('path="ministries"');
    expect(routes).toContain('path="ministries/:ministryId"');
    expect(services).toContain('to: "/portal/ministries"');
  });

  it("keeps feature visibility fail closed", () => {
    expect(features).toContain('{ prefix: "/portal/ministries", featureKey: "ministries" }');
    expect(services).toContain('featureKey: "ministries"');
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
});
