import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("production Wave 1 scope guard", () => {
  it("preserves production livestream providers, route, card, and player", () => {
    const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");
    const home = readFileSync(join(process.cwd(), "src/components/portal/MobileMemberHome.tsx"), "utf8");
    expect(routes).toContain("PersistentLivestreamProvider");
    expect(routes).toContain("PersistentLivestreamPlayer");
    expect(routes).toContain('path="live/:streamId"');
    expect(home).toContain("ProductionLiveMassCard");
  });

  it("does not add excluded architecture to the member router", () => {
    const routes = readFileSync(join(process.cwd(), "src/routes/MemberRoutes.tsx"), "utf8");
    for (const excluded of ["WorkspaceRouteLayout", "PastoralRoutes", "FinanceRoutes", "RadioPlayer", "KanisaAI"]) {
      expect(routes).not.toContain(excluded);
    }
  });
});
