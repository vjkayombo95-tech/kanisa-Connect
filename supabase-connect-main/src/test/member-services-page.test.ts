import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/pages/portal/MemberServicesPage.tsx"), "utf8");

describe("mobile Huduma Zote information architecture", () => {
  it("groups services under member-friendly Kiswahili sections", () => {
    for (const heading of ["Huduma za Haraka", "Ibada", "Imani", "Parokia", "Zaidi"]) {
      expect(source).toContain(heading);
    }
    expect(source).toContain('label: "Uliza Kanisa"');
    expect(source).not.toContain('label: "Kanisa AI"');
  });

  it("filters locally while preserving feature controls", () => {
    expect(source).toContain('placeholder="Tafuta huduma..."');
    expect(source).toContain("normalizeSearch");
    expect(source).toContain("getFeatureState(item.featureFlag).visible");
  });

  it("keeps the redesigned experience mobile-only", () => {
    expect(source).toContain('className="space-y-8 lg:hidden"');
    expect(source).toContain("DesktopServicesList");
  });

  it("opens only quick services by default and allows independent section state", () => {
    expect(source).toContain("frequent: true");
    for (const section of ["worship", "faith", "parish", "more"]) expect(source).toContain(`${section}: false`);
    expect(source).toContain("...current, [section.id]: !current[section.id]");
    expect(source).toContain("aria-expanded={expanded}");
  });

  it("limits Zaidi and exposes a real remaining count", () => {
    expect(source).toContain("const MORE_INITIAL_LIMIT = 4");
    expect(source).toContain("items.slice(0, MORE_INITIAL_LIMIT)");
    expect(source).toContain("Ona huduma nyingine (${remainingCount})");
    expect(source).toContain('"Onyesha chache"');
  });

  it("bypasses collapsed state during local search", () => {
    expect(source).toContain('id="service-search-results"');
    expect(source).toContain(">Matokeo<");
    expect(source).toContain("<MobileServiceRows items={filteredItems} />");
  });
});
