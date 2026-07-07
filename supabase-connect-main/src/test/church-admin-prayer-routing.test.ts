import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { getCmsPrayerIdentifierColumn, isCmsPrayerUuid } from "@/lib/super-admin/prayer-library-service";
import { getPrayerDetailPath, getPrayerLibraryRoot, getPrayerRoot } from "@/lib/prayer-routing";

const adminRoutesSource = readFileSync(path.resolve("src/routes/AdminRoutes.tsx"), "utf8");
const memberLibrarySource = readFileSync(path.resolve("src/pages/portal/MemberLibraryPage.tsx"), "utf8");
const prayerDetailSource = readFileSync(path.resolve("src/pages/portal/PortalPrayerPage.tsx"), "utf8");

describe("Church Admin Prayer Library detail routing", () => {
  it("generates Church Admin prayer detail URLs with the prayer slug when available", () => {
    expect(getPrayerRoot("church_admin")).toBe("/church-admin/prayers");
    expect(getPrayerLibraryRoot("church_admin")).toBe("/church-admin/saints");
    expect(getPrayerDetailPath("church_admin", { id: "11111111-1111-4111-8111-111111111111", slug: "prayer-for-students" })).toBe(
      "/church-admin/prayers/prayer-for-students",
    );
  });

  it("keeps Kiswahili and English card actions on the same route architecture", () => {
    expect(en.member_portal.catholic_content.open_prayer).toBe("Open Prayer");
    expect(sw.member_portal.catholic_content.open_prayer).toBe("Fungua Sala");
    expect(memberLibrarySource).toContain("getPrayerDetailPath(page.workspaceId, prayer)");
  });

  it("registers the Church Admin prayer detail route inside the workspace route tree", () => {
    expect(adminRoutesSource).toContain('WorkspaceRouteLayout workspaceId="church_admin"');
    expect(adminRoutesSource).toContain('const PortalPrayerPage = lazy(() => import("@/pages/portal/PortalPrayerPage"))');
    expect(adminRoutesSource).toContain('<Route path="prayers/:prayerId" element={<PortalPrayerPage />} />');
  });

  it("routes CMS identifiers safely by UUID or slug", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    expect(isCmsPrayerUuid(uuid)).toBe(true);
    expect(getCmsPrayerIdentifierColumn(uuid)).toBe("id");
    expect(isCmsPrayerUuid("prayer-for-students")).toBe(false);
    expect(getCmsPrayerIdentifierColumn("prayer-for-students")).toBe("slug");
  });

  it("does not query slug identifiers against the UUID id field", () => {
    const serviceSource = readFileSync(path.resolve("src/lib/super-admin/prayer-library-service.ts"), "utf8");
    expect(serviceSource).toContain("query.eq(getCmsPrayerIdentifierColumn(idOrSlug), idOrSlug)");
    expect(serviceSource).not.toContain('isUuid(idOrSlug) ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug)');
  });

  it("keeps visible safe states for invalid, missing, and failed detail loads", () => {
    expect(en.member_portal.prayer_detail.not_found_title).toBeTruthy();
    expect(en.member_portal.prayer_detail.error_title).toBeTruthy();
    expect(sw.member_portal.prayer_detail.not_found_title).toBeTruthy();
    expect(sw.member_portal.prayer_detail.error_title).toBeTruthy();
    expect(prayerDetailSource).toContain("!isLoading && !isError && !data");
    expect(prayerDetailSource).toContain("isError");
    expect(prayerDetailSource).toContain("getPrayerLibraryRoot(page.workspaceId)");
  });
});
