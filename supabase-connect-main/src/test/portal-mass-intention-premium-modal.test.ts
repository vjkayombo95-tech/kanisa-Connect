import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "src/pages/portal/PortalMassIntentions.tsx"), "utf8");

describe("premium Portal Mass Intention modal", () => {
  it("keeps the existing submission and offline business paths", () => {
    expect(source).toContain("submitPortalMassIntention({");
    expect(source).toContain("enqueueOfflineSyncAction({");
    expect(source).toContain('type: "mass_intention_create"');
    expect(source).toContain("assertClientRateLimit");
    expect(source).toContain("idempotency_key: crypto.randomUUID()");
    expect(source).toContain('queryKey: ["portal-mass-intentions"]');
    expect(source).toContain('queryKey: ["my-mass-intentions"]');
  });

  it("implements the four guided steps and review editing", () => {
    expect(source).toContain('title: "Aina ya Nia"');
    expect(source).toContain('title: "Maelezo"');
    expect(source).toContain('title: "Maelezo ya Misa"');
    expect(source).toContain('title: "Kagua na Thibitisha"');
    expect(source).toContain("const goNext = () =>");
    expect(source).toContain("const goBack = () =>");
    expect(source).toContain("Hariri");
    expect(source).toContain("Thibitisha na Wasilisha");
  });

  it("adds accessible selection, validation, reduced-motion, and duplicate-submit protections", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('role="radiogroup"');
    expect(source).toContain('role="radio"');
    expect(source).toContain("aria-checked={selected}");
    expect(source).toContain("useReducedMotion");
    expect(source).toContain("disabled={submit.isPending");
    expect(source).toContain("if (submit.isPending) return;");
    expect(source).toContain("setStepErrors");
  });

  it("keeps the requested intention types as premium selectable cards", () => {
    for (const value of ["shukrani", "marehemu", "maombi_maalum", "wagonjwa", "safari", "mtakatifu_wa_familia", "other"]) {
      expect(source).toContain(`value: "${value}"`);
    }

    expect(source).toContain("whileHover");
    expect(source).toContain("whileTap");
    expect(source).toContain("border-amber-300/80");
    expect(source).toContain("shadow-[inset_0_0_34px");
  });
});
