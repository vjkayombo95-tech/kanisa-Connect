import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n, { changeAppLanguage } from "@/i18n";
import { getMemberBackTitle, getMemberBackTitleKey } from "@/lib/member-service-registry";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const source = read("src/components/portal/MemberMobileBackHeader.tsx");

describe("MemberMobileBackHeader localization", () => {
  it("resolves ordinary back titles from canonical registry translation keys", async () => {
    expect(getMemberBackTitleKey("/portal/jumuiya")).toBe("member_services.jumuiya.back_title");
    expect(getMemberBackTitleKey("/portal/channels")).toBe("member_services.channels.back_title");
    expect(getMemberBackTitleKey("/portal/ministries")).toBe("member_services.ministries.back_title");
    expect(getMemberBackTitle("/portal/ministries/ministry-a")).toBe("Huduma za Parokia");

    await changeAppLanguage("en");
    expect(i18n.t(getMemberBackTitleKey("/portal/jumuiya")!)).toBe("My Small Christian Community");
    expect(i18n.t(getMemberBackTitleKey("/portal/channels")!)).toBe("Communication Channels");
    expect(i18n.t(getMemberBackTitleKey("/portal/ministries")!)).toBe("Parish Ministries");
    expect(i18n.t("member_mobile.back_from", { title: i18n.t(getMemberBackTitleKey("/portal/jumuiya")!) })).toBe("Back from My Small Christian Community");

    await changeAppLanguage("sw");
    expect(i18n.t(getMemberBackTitleKey("/portal/jumuiya")!)).toBe("Jumuiya Yangu");
    expect(i18n.t(getMemberBackTitleKey("/portal/channels")!)).toBe("Njia za Mawasiliano");
    expect(i18n.t(getMemberBackTitleKey("/portal/ministries")!)).toBe("Huduma za Parokia");
    expect(i18n.t("member_mobile.back_from", { title: i18n.t(getMemberBackTitleKey("/portal/jumuiya")!) })).toBe("Rudi kutoka Jumuiya Yangu");
  });

  it("keeps detail routes and unknown-route fallback localized without duplicate hard-coded maps", () => {
    expect(source).toContain('t("member_services.contribution_history.receipt_title")');
    expect(source).toContain('t("member_services.bible.chapter_title")');
    expect(source).toContain('t("member_services.bible.back_title")');
    expect(source).toContain('t("member_services.library.detail_title")');
    expect(source).toContain('t("member_services.livestream.back_title")');
    expect(source).toContain('t("member_services.ministries.back_title")');
    expect(source).toContain('t("member_services.services.label")');
    expect(source).toContain("translateSystemLabel(t, getMemberBackTitleKey(pathname), getMemberBackTitle(pathname) ?? t(\"member_services.services.label\"))");
    expect(source).not.toContain("titleByRoute");
    expect(source).not.toContain("titleKeyByRoute");
    expect(source).not.toContain('"/portal/jumuiya": "Jumuiya Yangu"');
    expect(source).not.toContain('"/portal/channels": "Njia za Mawasiliano"');
    expect(source).not.toContain('"/portal/ministries": "Huduma za Parokia"');
  });

  it("preserves safe mobile back navigation behavior", () => {
    expect(source).toContain("isPrimaryMemberRoute(location.pathname)");
    expect(source).toContain("resolveMemberBackTarget(");
    expect(source).toContain("stateFrom");
    expect(source).toContain("document.referrer");
    expect(source).toContain("window.location.origin");
    expect(source).toContain("navigate(target)");
    expect(source).not.toContain("navigate(-1)");
    expect(source).toContain('data-testid="member-mobile-back-header"');
    expect(source).toContain('aria-label={t("member_mobile.back_from", { title })}');
    expect(source).toContain("lg:hidden");
  });
});
