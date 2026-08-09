import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(join(process.cwd(), "src/components/portal/MobileMemberHome.tsx"), "utf8");
const workspace = readFileSync(join(process.cwd(), "src/components/workspace/framework.tsx"), "utf8");

describe("premium member mobile home polish", () => {
  it("keeps the four primary routes and coherent Lucide icon treatment", () => {
    for (const route of ["/portal/give", "/portal/mass-intentions", "/portal/announcements", "/portal/kanisa-ai"]) expect(home).toContain(route);
    expect(home).toContain("stroke-[1.8]");
  });

  it("uses selective translucent depth and restrained interaction motion", () => {
    expect(home).toContain("bg-card/80");
    expect(home).toContain("backdrop-blur-sm");
    expect(home).toContain("active:scale-[0.98]");
    expect(home).toContain("duration-200");
  });

  it("respects reduced motion and preserves visible keyboard focus", () => {
    expect(home).toContain("motion-reduce:active:scale-100");
    expect(home).toContain("motion-reduce:transition-none");
    expect(home).toContain("focus-visible:ring-2");
  });

  it("places the optional livestream experience between the parish greeting and quick actions", () => {
    expect(home).toContain("<LiveMassCard churchName={home.churchName} />");
    expect(home.indexOf("<LiveMassCard")).toBeGreaterThan(home.indexOf("Habari, {firstName}"));
    expect(home.indexOf("<LiveMassCard")).toBeLessThan(home.indexOf('aria-labelledby="member-actions-title"'));
  });

  it("polishes only the member bottom navigation", () => {
    expect(workspace).toContain('workspace.id === "member"');
    expect(workspace).toContain("supports-[backdrop-filter]:bg-background/75");
    expect(workspace).toContain('active && "bg-primary/[0.07] text-primary"');
  });
});
