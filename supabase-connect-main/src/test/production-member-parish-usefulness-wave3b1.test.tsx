import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getParishDirectionsHref,
  getParishEmailHref,
  getParishMapHref,
  getParishPhoneHref,
  normalizeParishContact,
} from "@/lib/member-daily-life";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const sw = JSON.parse(read("locales/sw.json")) as {
  member_my_parish: {
    actions: { directions: string };
    sections: Record<"contact_location" | "next_mass" | "latest_announcement" | "upcoming_events" | "my_ministries" | "quick_links", string>;
    hero: { eyebrow: string };
  };
  member_services: Record<"livestream" | "radio", { label: string }>;
};

describe("Wave 3B1 parish usefulness", () => {
  const parishPage = read("pages/portal/MemberMyParishPage.tsx");
  const ministriesPage = read("pages/portal/MemberMinistriesPage.tsx");
  const portalLayout = read("components/portal/PortalLayout.tsx");

  it("normalizes optional contact values and rejects unsafe phone input", () => {
    expect(normalizeParishContact("  St Joseph  ")).toBe("St Joseph");
    expect(normalizeParishContact("   ")).toBeNull();
    expect(normalizeParishContact("unsafe\0value")).toBeNull();
    expect(getParishPhoneHref("+255 (700) 123-456")).toBe("tel:+255700123456");
    expect(getParishPhoneHref("javascript:255700123456")).toBeNull();
    expect(getParishPhoneHref("not-a-number")).toBeNull();
    expect(getParishPhoneHref("++255700123456")).toBeNull();
    expect(getParishPhoneHref("255+700123456")).toBeNull();
    expect(getParishPhoneHref("255\n700123456")).toBeNull();
  });

  it("creates query-free email and encoded map actions", () => {
    expect(getParishEmailHref(" parish@example.test ")).toBe("mailto:parish%40example.test");
    expect(getParishEmailHref("parish@example.test?subject=unsafe")).toBeNull();
    expect(getParishEmailHref("parish@example.test\r\nBcc:test@example.test")).toBeNull();
    expect(getParishMapHref("St Joseph, Dar es Salaam")).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%2C%20Dar%20es%20Salaam",
    );
    expect(normalizeParishContact("  St Joseph\nDar es Salaam\tTanzania  ")).toBe("St Joseph Dar es Salaam Tanzania");
    expect(getParishMapHref("St Joseph\nDar es Salaam")).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%20Dar%20es%20Salaam",
    );
    expect(getParishDirectionsHref({ address: "St Joseph", latitude: 0, longitude: 39.2 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=0,39.2",
    );
    expect(getParishDirectionsHref({ address: "St Joseph, Dar es Salaam", latitude: null, longitude: null })).toBe(
      "https://www.google.com/maps/search/?api=1&query=St%20Joseph%2C%20Dar%20es%20Salaam",
    );
  });

  it("keeps contact rendering nullable, compact, and clipboard-safe", () => {
    expect(parishPage).toContain("(phoneHref || emailHref) ?");
    expect(parishPage).toContain("directionsHref ?");
    expect(parishPage).toContain('t("member_my_parish.actions.directions")');
    expect(sw.member_my_parish.actions.directions).toBe("Pata Maelekezo");
    expect(parishPage).toContain("navigator.clipboard?.writeText");
    expect(parishPage).toContain('target="_blank" rel="noopener noreferrer"');
    expect(parishPage).toContain("overflow-x-hidden");
    expect(parishPage).toContain("pb-28");
  });

  it("orders parish priorities and uses compact eligible media shortcuts", () => {
    const identity = parishPage.indexOf('t("member_my_parish.hero.eyebrow")');
    const contact = parishPage.indexOf('aria-label={t("member_my_parish.sections.contact_location")}');
    const mass = parishPage.indexOf('title={t("member_my_parish.sections.next_mass")}');
    const announcement = parishPage.indexOf('title={t("member_my_parish.sections.latest_announcement")}');
    const events = parishPage.indexOf('title={t("member_my_parish.sections.upcoming_events")}');
    const ministries = parishPage.indexOf('title={t("member_my_parish.sections.my_ministries")}');
    const shortcuts = parishPage.indexOf('aria-label={t("member_my_parish.sections.quick_links")}');
    expect(identity).toBeGreaterThan(-1);
    expect(contact).toBeGreaterThan(identity);
    expect(mass).toBeGreaterThan(contact);
    expect(announcement).toBeGreaterThan(mass);
    expect(events).toBeGreaterThan(announcement);
    expect(ministries).toBeGreaterThan(events);
    expect(shortcuts).toBeGreaterThan(ministries);
    expect(sw.member_my_parish.hero.eyebrow).toBe("Parokia Yangu");
    expect(sw.member_my_parish.sections.contact_location).toBe("Mawasiliano na mahali pa parokia");
    expect(sw.member_my_parish.sections.next_mass).toBe("Misa ijayo");
    expect(sw.member_my_parish.sections.latest_announcement).toBe("Tangazo la karibuni");
    expect(sw.member_my_parish.sections.upcoming_events).toBe("Matukio yajayo");
    expect(sw.member_my_parish.sections.my_ministries).toBe("Huduma zangu");
    expect(sw.member_my_parish.sections.quick_links).toBe("Njia za haraka");
    expect(parishPage).toContain('title={t("member_services.radio.label")}');
    expect(parishPage).toContain('title={t("member_services.livestream.label")}');
    expect(sw.member_services.radio.label).toBe("Radio");
    expect(sw.member_services.livestream.label).toBe("Misa Mubashara");
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
