import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldRenderUlizaKanisa } from "@/lib/uliza-feature-gate";

describe("production Wave 5B feature gate", () => {
  it("fails closed until feature state finishes loading", () => {
    expect(shouldRenderUlizaKanisa("loading")).toBe(false);
  });

  it("fails closed without explicit church enablement and opens only with it", () => {
    expect(shouldRenderUlizaKanisa("disabled")).toBe(false);
    expect(shouldRenderUlizaKanisa("error")).toBe(false);
    expect(shouldRenderUlizaKanisa("enabled")).toBe(true);
  });

  it("keeps the service hidden by explicit opt-in and preserves mobile-safe layout", () => {
    const services = readFileSync(join(process.cwd(), "src/pages/portal/MemberServicesPage.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/pages/portal/KanisaAssistantPage.tsx"), "utf8");
    const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");
    const gate = readFileSync(join(process.cwd(), "src/components/portal/UlizaKanisaFeatureGate.tsx"), "utf8");
    expect(services).toContain('requiresExplicitChurchEnable: true');
    expect(services).toContain("isFeatureExplicitlyEnabledForChurch(item.featureKey)");
    expect(routes).toContain('path="kanisa-ai"');
    expect(routes).toContain("<UlizaKanisaFeatureGate>");
    expect(gate).toContain('<Navigate to="/portal" replace />');
    expect(page).toContain("max-w-3xl");
    expect(page).toContain("min-w-0");
    expect(page).toContain("pb-28");
  });
});
