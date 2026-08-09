import { describe, expect, it } from "vitest";

import { workspaceRegistry } from "@/components/workspace/registry";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const actualMemberRoutePaths = [
  "/portal",
  "/portal/dashboard",
  "/portal/bible-verses",
  "/portal/events",
  "/portal/calendar",
  "/portal/event-requests",
  "/portal/sermons",
  "/portal/announcements",
  "/portal/give",
  "/portal/contribution-history",
  "/portal/contribution-receipt/:contributionId",
  "/portal/pledges",
  "/portal/prayer-requests",
  "/portal/prayers/:prayerId",
  "/portal/reflections",
  "/portal/reflections/:reflectionId",
  "/portal/mass-intentions",
  "/portal/ministries",
  "/portal/ministries/:ministryId",
  "/portal/community-help",
  "/portal/channels",
  "/portal/library",
  "/portal/library/:slug",
  "/portal/saints/:saintId",
  "/portal/liturgical-calendar",
  "/portal/daily-readings",
  "/portal/kanisa-ai",
  "/portal/bible",
  "/portal/bible/:bookId",
  "/portal/bible/:bookId/chapter/:chapterNumber",
];

function getNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("member Kiswahili UAT readiness", () => {
  it("keeps member navigation owned by the member workspace", () => {
    const memberRoutes = workspaceRegistry.member.navigation.flatMap((group) => group.items.map((item) => item.to));

    expect(memberRoutes.length).toBeGreaterThan(0);
    expect(memberRoutes.every((route) => route.startsWith("/portal"))).toBe(true);
    expect(memberRoutes.some((route) => route.startsWith("/church-admin"))).toBe(false);
    expect(memberRoutes.some((route) => route.startsWith("/finance"))).toBe(false);
    expect(memberRoutes.some((route) => route.startsWith("/pastoral"))).toBe(false);
    expect(memberRoutes.some((route) => route.startsWith("/super-admin"))).toBe(false);
  });

  it("documents actual member route gaps without adding routes", () => {
    expect(actualMemberRoutePaths).not.toContain("/portal/notifications");
    expect(actualMemberRoutePaths).not.toContain("/portal/profile");
    expect(actualMemberRoutePaths).not.toContain("/portal/settings");
    expect(actualMemberRoutePaths).not.toContain("/portal/sacramental-history");
  });

  it("keeps member navigation labels available in English and Kiswahili", () => {
    const requiredNavigationKeys = workspaceRegistry.member.navigation.flatMap((group) => [
      `navigation.groups.${group.id}`,
      ...group.items.map((item) => `navigation.items.${item.id}`),
    ]);

    requiredNavigationKeys.forEach((key) => {
      expect(getNestedValue(en, key), `missing English key ${key}`).toBeTruthy();
      expect(getNestedValue(sw, key), `missing Kiswahili key ${key}`).toBeTruthy();
    });
  });
});
