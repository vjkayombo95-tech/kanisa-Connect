import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("PortalPrayerRequests visual copy contract", () => {
  const portalPrayerRequests = read("src/pages/portal/PortalPrayerRequests.tsx");
  const en = JSON.parse(read("src/locales/en.json"));
  const sw = JSON.parse(read("src/locales/sw.json"));

  it("uses the member prayer request localization namespace for member-facing page copy", () => {
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.title")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.subtitle")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.actions.create")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.tabs.community")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.tabs.mine"');
    expect(en.member_prayer_requests.title).toBe("Prayer Requests");
    expect(sw.member_prayer_requests.title).toBe("Maombi");
    expect(en.member_prayer_requests.tabs.community).toBe("Community Prayers");
    expect(sw.member_prayer_requests.tabs.community).toBe("Maombi ya Waumini");
  });

  it("presents privacy choices with member-friendly labels while keeping stored values", () => {
    expect(portalPrayerRequests).toContain('value: "public_to_church"');
    expect(portalPrayerRequests).toContain('value: "private_to_pastor_admin"');
    expect(portalPrayerRequests).toContain('value: "anonymous_public"');
    expect(portalPrayerRequests).toContain("PRAYER_PRIVACY_OPTIONS.map");
    expect(portalPrayerRequests).toContain('t(option.labelKey)');
    expect(portalPrayerRequests).toContain('t(option.descriptionKey)');
    expect(portalPrayerRequests).toContain('request.privacy === "anonymous_public" ? t("member_prayer_requests.anonymous_requester") : request.member_name');
    expect(sw.member_prayer_requests.privacy.anonymous_public.description).toContain("bila kuonyesha jina lako kwa waumini");
  });

  it("keeps optional offering gentle without implying prayer can be purchased", () => {
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.offering.label")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.offering.helper")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.offering.reassurance")');
    expect(sw.member_prayer_requests.offering.helper).toContain("si sharti");
    expect(en.member_prayer_requests.offering.helper).toContain("not required");
    expect(portalPrayerRequests).not.toMatch(/higher priority|priority with the pastor|guarantees prayer|required for submission/i);
    expect(portalPrayerRequests).not.toMatch(/M-Pesa|Mpesa|Airtel Money|Mixx by Yas|Selcom|Stripe|PayPal|card processing|checkout session/i);
  });

  it("uses member-friendly status and support copy", () => {
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.status.approved")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.status.pending")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.status.rejected")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.comments.heading")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.actions.pray")');
    expect(sw.member_prayer_requests.status.pending).toBe("Inasubiri mapitio");
    expect(sw.member_prayer_requests.comments.heading).toBe("Ujumbe wa Faraja");
    expect(portalPrayerRequests).not.toContain(">Mark as Prayed<");
    expect(portalPrayerRequests).not.toContain(">Comments");
  });

  it("polishes offline and empty states for mobile members", () => {
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.offline.title")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.offline.count"');
    expect(portalPrayerRequests).toContain('t("common.sync_now")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.states.community_empty_title")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.states.community_empty_description")');
    expect(portalPrayerRequests).toContain('t("member_prayer_requests.states.mine_empty_title")');
    expect(sw.member_prayer_requests.offline.title).toBe("Maombi yaliyosubiri kutumwa");
    expect(portalPrayerRequests).toContain("pb-28");
    expect(portalPrayerRequests).toContain("w-full");
    expect(portalPrayerRequests).toContain("min-w-0");
  });
});
