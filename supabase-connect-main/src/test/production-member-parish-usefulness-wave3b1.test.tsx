import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getParishEmailHref,
  getParishMapHref,
  getParishPhoneHref,
  normalizeParishContact,
} from "@/lib/member-daily-life";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Wave 3B1 parish usefulness", () => {
  const parishPage = read("pages/portal/MemberMyParishPage.tsx");
  const ministriesPage = read("pages/portal/MemberMinistriesPage.tsx");
  const portalLayout = read("components/portal/PortalLayout.tsx");

  it("normalizes optional contact values and rejects unsafe phone input", () => {
    expect(normalizeParishContact("  St Joseph  ")).toBe("St Joseph");
    expect(normalizeParishContact("   ")).toBeNull();
    expect(normalizeParishContact("unsafe\nvalue")).toBeNull();
    expect(getParishPhoneHref("+255 (700) 123-456")).toBe("tel:+255700123456");
    expect(getParishPhoneHref("javascript:255700123456")).toBeNull();
    expect(getParishPhoneHref("not-a-number")).toBeNull();
  });

  it("creates query-free email and encoded map actions", () => {
    expect(getParishEmailHref(" parish@example.test ")).toBe("mailto:parish%40example.test");
    expect(getParishEmailHref("parish@example.test?subject=unsafe")).toBeNull();
    expect(getParishEmailHref("parish@example.test\r\nBcc:test@example.test")).toBeNull();
    expect(getParishMapHref("St Joseph, Dar es Salaam")).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%2C%20Dar%20es%20Salaam",
    );
  });

  it("keeps contact rendering nullable, compact, and clipboard-safe", () => {
    expect(parishPage).toContain("(phoneHref || emailHref || mapHref) ?");
    expect(parishPage).toContain("navigator.clipboard?.writeText");
    expect(parishPage).toContain('target="_blank" rel="noopener noreferrer"');
    expect(parishPage).toContain("overflow-x-hidden");
    expect(parishPage).toContain("pb-28");
  });

  it("orders parish priorities and uses compact eligible media shortcuts", () => {
    const identity = parishPage.indexOf('aria-label="Mawasiliano ya parokia"');
    const events = parishPage.indexOf("Matukio yajayo");
    const ministries = parishPage.indexOf("Huduma zangu");
    const shortcuts = parishPage.indexOf("Njia za haraka");
    expect(identity).toBeGreaterThan(-1);
    expect(events).toBeGreaterThan(identity);
    expect(ministries).toBeGreaterThan(events);
    expect(shortcuts).toBeGreaterThan(ministries);
    expect(parishPage).toContain('title="Redio"');
    expect(parishPage).toContain('title="Misa Mubashara"');
  });

  it("uses explicit ministry hierarchy, empty states, and named leave confirmation", () => {
    expect(ministriesPage.indexOf("Huduma zangu")).toBeLessThan(ministriesPage.indexOf("Huduma nyingine"));
    expect(ministriesPage).toContain("Hakuna huduma zilizowekwa kwa parokia hii.");
    expect(ministriesPage).toContain("Hakuna huduma zinazolingana na utafutaji wako.");
    expect(ministriesPage).toContain("Unakaribia kuondoka kwenye huduma ya {ministry.name}");
    expect(ministriesPage).toContain("if (leaveRequested.current || mutation.isPending) return");
  });

  it("routes Historia Yangu through the existing SPA link", () => {
    expect(portalLayout).toContain('<AppLink to="/portal/dashboard" onClick={() => setMobileOpen(false)}>');
    expect(portalLayout).toContain("Historia Yangu");
    expect(portalLayout).not.toContain('titleKey: "Wasifu"');
    expect(portalLayout).not.toContain('window.location.assign("/portal/dashboard")');
  });
});
