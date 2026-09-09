import { describe, expect, it } from "vitest";

import { getMemberBackFallback, isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";

describe("production member mobile back navigation", () => {
  it.each([
    "/portal",
    "/portal/today",
    "/portal/my-parish",
    "/portal/services",
    "/member",
    "/member/today",
    "/member/my-parish",
    "/member/services",
  ])("keeps %s as a primary route", (route) => {
    expect(isPrimaryMemberRoute(route)).toBe(true);
  });

  it.each(["/portal/give", "/portal/mass-intentions", "/portal/announcements", "/portal/jumuiya"])(
    "keeps %s as a secondary route",
    (route) => {
      expect(isPrimaryMemberRoute(route)).toBe(false);
    },
  );

  it("uses a validated member origin when route state exists", () => {
    expect(resolveMemberBackTarget("/portal/mass-intentions", "/portal")).toBe("/portal");
    expect(resolveMemberBackTarget("/portal/mass-intentions", "https://external.test")).toBe("/portal/services");
  });

  it("accepts only same-origin member referrers", () => {
    expect(resolveMemberBackTarget("/portal/bible", undefined, "https://kanisa.test/portal", "https://kanisa.test")).toBe("/portal");
    expect(resolveMemberBackTarget("/portal/bible", undefined, "https://external.test/portal", "https://kanisa.test")).toBe("/portal/services");
  });

  it("uses logical parents for nested production routes", () => {
    expect(getMemberBackFallback("/portal/bible/john/chapter/3")).toBe("/portal/bible/john");
    expect(getMemberBackFallback("/portal/bible/john")).toBe("/portal/bible");
    expect(getMemberBackFallback("/member/library/saint-peter")).toBe("/member/library");
  });
});
