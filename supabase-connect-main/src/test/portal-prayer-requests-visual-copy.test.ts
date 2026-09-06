import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

describe("PortalPrayerRequests visual copy contract", () => {
  const portalPrayerRequests = read("src/pages/portal/PortalPrayerRequests.tsx");

  it("uses Kiswahili-first member-facing prayer request language", () => {
    expect(portalPrayerRequests).toContain(">Maombi<");
    expect(portalPrayerRequests).toContain("Shiriki ombi lako la maombi au ungana na waumini wengine katika kuwaombea.");
    expect(portalPrayerRequests).toContain("Tuma Ombi la Maombi");
    expect(portalPrayerRequests).toContain("Maombi ya Waumini");
    expect(portalPrayerRequests).toContain("Maombi Yangu");
    expect(portalPrayerRequests).not.toContain(">Prayer Requests<");
    expect(portalPrayerRequests).not.toContain(">Submit Request<");
    expect(portalPrayerRequests).not.toContain(">Community Prayers<");
    expect(portalPrayerRequests).not.toContain(">My Requests");
  });

  it("presents privacy choices with member-friendly labels while keeping stored values", () => {
    expect(portalPrayerRequests).toContain('value="public_to_church"');
    expect(portalPrayerRequests).toContain("Waumini wa Kanisa");
    expect(portalPrayerRequests).toContain('value="private_to_pastor_admin"');
    expect(portalPrayerRequests).toContain("Mchungaji/Uongozi pekee");
    expect(portalPrayerRequests).toContain('value="anonymous_public"');
    expect(portalPrayerRequests).toContain("Bila kutaja jina");
    expect(portalPrayerRequests).toContain("bila kuonyesha jina lako kwa waumini");
    expect(portalPrayerRequests).toContain('request.privacy === "anonymous_public" ? "Muumini" : request.member_name');
    expect(portalPrayerRequests).not.toContain('request.privacy === "anonymous_public" ? "Anonymous" : request.member_name');
  });

  it("keeps optional offering gentle without implying prayer can be purchased", () => {
    expect(portalPrayerRequests).toContain("Sadaka ya Hiari");
    expect(portalPrayerRequests).toContain("Sadaka ni ya hiari kabisa na si sharti la kutuma ombi la maombi.");
    expect(portalPrayerRequests).toContain("Maombi yako yatapokelewa hata kama hutachagua kutoa sadaka.");
    expect(portalPrayerRequests).not.toMatch(/higher priority|priority with the pastor|guarantees prayer|required for submission/i);
    expect(portalPrayerRequests).not.toMatch(/M-Pesa|Mpesa|Airtel Money|Mixx by Yas|Selcom|Stripe|PayPal|card processing|checkout session/i);
  });

  it("uses member-friendly status and support copy", () => {
    expect(portalPrayerRequests).toContain("Inasubiri mapitio");
    expect(portalPrayerRequests).toContain("Imepokelewa");
    expect(portalPrayerRequests).toContain("Haikuchapishwa");
    expect(portalPrayerRequests).toContain("Ombi lako limepokelewa na linasubiri mapitio kabla ya kuonekana kwa waumini.");
    expect(portalPrayerRequests).toContain("Ujumbe wa Faraja");
    expect(portalPrayerRequests).toContain("Nimeombea");
    expect(portalPrayerRequests).not.toContain(">Mark as Prayed<");
    expect(portalPrayerRequests).not.toContain(">Comments");
  });

  it("polishes offline and empty states for mobile members", () => {
    expect(portalPrayerRequests).toContain("Maombi yaliyosubiri kutumwa");
    expect(portalPrayerRequests).toContain("imesubiri kutumwa");
    expect(portalPrayerRequests).toContain("Sawazisha sasa");
    expect(portalPrayerRequests).toContain("Hakuna maombi yaliyoshirikiwa kwa sasa.");
    expect(portalPrayerRequests).toContain("Unaweza kuwa wa kwanza kushiriki ombi la maombi.");
    expect(portalPrayerRequests).toContain("Bado hujatuma ombi la maombi.");
    expect(portalPrayerRequests).toContain("pb-28");
    expect(portalPrayerRequests).toContain("w-full");
    expect(portalPrayerRequests).toContain("min-w-0");
  });
});
