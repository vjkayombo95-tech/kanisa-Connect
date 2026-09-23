import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import i18n, { changeAppLanguage } from "@/i18n";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import {
  formatAppDate,
  translateMemberBackTitle,
  translateMemberServiceDescription,
  translateMemberServiceGroup,
  translateMemberServiceLabel,
  translateRoleLabel,
  translateStaffServiceGroup,
  translateStaffServiceLabel,
  translateStaffWorkLabel,
  translateStatusLabel,
} from "@/lib/localization";
import { memberServiceGroups, memberServiceRegistry } from "@/lib/member-service-registry";
import { STAFF_MOBILE_CONFIGS, getCommunityMobileConfig } from "@/lib/staff-mobile-registry";

type LocaleTree = Record<string, unknown>;
const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

function translator(locale: LocaleTree) {
  return (key: string, options?: Record<string, unknown>) => {
    const value = key.split(".").reduce<unknown>((current, part) => (
      current && typeof current === "object" ? (current as LocaleTree)[part] : undefined
    ), locale);
    if (typeof value !== "string") return String(options?.defaultValue ?? key);
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ""));
  };
}

describe("Wave 26A localization foundation", () => {
  const tEn = translator(en);
  const tSw = translator(sw);

  it("keeps active locale keys in parity", () => {
    expect(flattenKeys(sw).sort()).toEqual(flattenKeys(en).sort());
  });

  it("keeps role display labels separate from the existing roles navigation label", async () => {
    expect(typeof en.roles).toBe("string");
    expect(typeof sw.roles).toBe("string");
    expect(en.roles).toBe("Roles");
    expect(sw.roles).toBe("Majukumu");
    expect(en.role_labels.church_admin).toBe("Church Admin");
    expect(sw.role_labels.church_admin).toBe("Usimamizi wa Kanisa");
    expect(flattenKeys(en.role_labels).sort()).toEqual(flattenKeys(sw.role_labels).sort());
    expect(read("src/locales/en.json")).not.toMatch(/^ {2}"roles":\s+\{/m);
    expect(read("src/locales/sw.json")).not.toMatch(/^ {2}"roles":\s+\{/m);

    await changeAppLanguage("sw");
    expect(i18n.t("roles")).toBe("Majukumu");
    expect(translateRoleLabel(i18n.t, "church_admin")).toBe("Usimamizi wa Kanisa");

    await changeAppLanguage("en");
    expect(i18n.t("roles")).toBe("Roles");
    expect(translateRoleLabel(i18n.t, "church_admin")).toBe("Church Admin");
  });

  it("keeps staff registry identifiers, routes, permissions and feature gates separate from translated labels", () => {
    const office = STAFF_MOBILE_CONFIGS.admin.services.find((service) => service.id === "event-requests");
    expect(office).toMatchObject({
      id: "event-requests",
      route: "/church-admin/event-requests",
      featureKey: "event_requests",
      labelKey: "staff_services.event_requests.label",
      groupKey: "staff_service_groups.operations",
    });
    expect(translateStaffServiceLabel(tSw, office!)).toBe("Huduma za Ofisi");
    expect(translateStaffServiceLabel(tEn, office!)).toBe("Parish Office Services");
    expect(translateStaffServiceGroup(tSw, office!)).toBe("Uendeshaji");
    expect(translateStaffServiceGroup(tEn, office!)).toBe("Operations");
    expect(translateStaffWorkLabel(tEn, STAFF_MOBILE_CONFIGS.finance)).toBe("Contributions");
    expect(translateStaffWorkLabel(tSw, STAFF_MOBILE_CONFIGS.finance)).toBe("Michango");

    const community = getCommunityMobileConfig("community-a");
    expect(community.services.every((service) => service.route.startsWith("/community/community-a/"))).toBe(true);
    expect(community.services.every((service) => service.labelKey && service.groupKey)).toBe(true);
  });

  it("keeps member service registry routable while resolving SW and EN labels from keys", () => {
    const office = memberServiceRegistry.find((service) => service.id === "event-requests");
    expect(office).toMatchObject({
      path: "/portal/event-requests",
      featureKey: "event_requests",
      ordinaryMemberAllowed: true,
      labelKey: "member_services.event_requests.label",
      descriptionKey: "member_services.event_requests.description",
      backTitleKey: "member_services.event_requests.back_title",
    });
    expect(translateMemberServiceLabel(tSw, office!)).toBe("Huduma za Ofisi");
    expect(translateMemberServiceLabel(tEn, office!)).toBe("Parish Office Services");
    expect(translateMemberServiceDescription(tEn, office!)).toBe("Request services and track your requests");
    expect(translateMemberBackTitle(tSw, office!)).toBe("Huduma za Ofisi");

    const giving = memberServiceGroups.find((group) => group.id === "giving");
    expect(translateMemberServiceGroup(tSw, giving!)).toBe("Michango");
    expect(translateMemberServiceGroup(tEn, giving!)).toBe("Giving");
  });

  it("resolves status and role labels without exposing raw system identifiers", () => {
    expect(translateStatusLabel(tSw, "under_review")).toBe("Inaangaliwa");
    expect(translateStatusLabel(tEn, "under_review")).toBe("Under review");
    expect(translateRoleLabel(tSw, "church_admin")).toBe("Usimamizi wa Kanisa");
    expect(translateRoleLabel(tEn, "church_admin")).toBe("Church Admin");
  });

  it("updates visible system labels when the active i18n language changes", async () => {
    await changeAppLanguage("sw");
    expect(i18n.t("member_services.event_requests.label")).toBe("Huduma za Ofisi");
    expect(i18n.t("staff_services.members.label")).toBe("Wanachama");

    await changeAppLanguage("en");
    expect(i18n.t("member_services.event_requests.label")).toBe("Parish Office Services");
    expect(i18n.t("staff_services.members.label")).toBe("Members");
  });

  it("formats Tanzania dates by selected language and preserves date-only calendar values", () => {
    const options: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
    expect(formatAppDate("2026-09-01", "en", options)).toBe(
      formatAppDate(new Date("2026-09-01T12:00:00Z"), "en", { ...options, timeZone: "UTC" }),
    );
    expect(formatAppDate("2026-09-01", "sw", options)).toBe(
      formatAppDate(new Date("2026-09-01T12:00:00Z"), "sw", { ...options, timeZone: "UTC" }),
    );
    expect(formatAppDate("2026-09-01", "en", { ...options, timeZone: "America/Los_Angeles" })).toBe(
      formatAppDate("2026-09-01", "en", options),
    );
    expect(formatAppDate("2026-09-01", "sw", { ...options, timeZone: "America/Los_Angeles" })).toBe(
      formatAppDate("2026-09-01", "sw", options),
    );
    expect(formatAppDate(new Date("2026-08-31T21:30:00Z"), "en", options)).toBe(formatAppDate("2026-09-01", "en", options));
    expect(formatAppDate(new Date("2026-08-31T20:59:00Z"), "en", options)).not.toBe(formatAppDate("2026-09-01", "en", options));
    expect(formatAppDate(new Date("2026-08-31T21:30:00Z"), "en", { ...options, timeZone: "UTC" })).not.toBe(
      formatAppDate(new Date("2026-08-31T21:30:00Z"), "en", options),
    );
  });
});
