import { describe, expect, it } from "vitest";

import { getMemberBackFallback, isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";

describe("member mobile back navigation", () => {
  it.each(["/portal", "/portal/kanisa-ai", "/portal/services"])("does not add a back header to %s", (route) => {
    expect(isPrimaryMemberRoute(route)).toBe(true);
  });

  it("treats feature screens as deeper destinations", () => {
    expect(isPrimaryMemberRoute("/portal/contribution-history")).toBe(false);
    expect(isPrimaryMemberRoute("/portal/bible")).toBe(false);
  });

  it("returns to a validated origin when route state is present", () => {
    expect(resolveMemberBackTarget("/portal/mass-intentions", "/portal/kanisa-ai")).toBe("/portal/kanisa-ai");
  });

  it("uses a safe same-origin portal referrer for full-page AppLink navigation", () => {
    expect(resolveMemberBackTarget("/portal/bible", undefined, "https://kanisa.test/portal/services", "https://kanisa.test")).toBe("/portal/services");
    expect(resolveMemberBackTarget("/portal/bible", undefined, "https://external.test/page", "https://kanisa.test")).toBe("/portal/services");
  });

  it("uses Huduma Zote for direct feature entry", () => {
    expect(resolveMemberBackTarget("/portal/announcements")).toBe("/portal/services");
  });

  it("uses logical parents for nested member details", () => {
    expect(getMemberBackFallback("/portal/contribution-receipt/receipt-1")).toBe("/portal/contribution-history");
    expect(getMemberBackFallback("/portal/bible/john/chapter/3")).toBe("/portal/bible/john");
    expect(getMemberBackFallback("/portal/prayers/our-father")).toBe("/portal/prayers");
  });

  it("returns an in-app livestream viewer to the member home or its validated origin", () => {
    expect(getMemberBackFallback("/portal/live/stream-1")).toBe("/portal");
    expect(resolveMemberBackTarget("/portal/live/stream-1", "/portal/my-parish")).toBe("/portal/my-parish");
  });
});
