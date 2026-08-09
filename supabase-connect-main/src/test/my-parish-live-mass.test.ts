import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/portal/MyParishPage.tsx"), "utf8");

describe("MyParishPage live Mass integration", () => {
  it("mounts the authoritative LiveMassCard only with resolved church context", () => {
    expect(source).toContain('import { LiveMassCard } from "@/components/portal/LiveMassCard";');
    expect(source).toContain("{churchId ? <LiveMassCard churchName={contact.data?.name} /> : null}");
  });

  it("keeps live Mass separate and ahead of the existing Mass and sermon content", () => {
    const liveMassPosition = source.indexOf("{churchId ? <LiveMassCard");
    const todaysMassPosition = source.indexOf("<TodaysMassWidget");
    const sermonsPosition = source.indexOf("<RecordedSermonsWidget");

    expect(liveMassPosition).toBeGreaterThan(-1);
    expect(todaysMassPosition).toBeGreaterThan(liveMassPosition);
    expect(sermonsPosition).toBeGreaterThan(liveMassPosition);
  });
});
