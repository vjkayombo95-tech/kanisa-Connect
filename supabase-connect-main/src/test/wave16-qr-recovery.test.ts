import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { STAFF_MOBILE_CONFIGS } from "@/lib/staff-mobile-registry";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 16 QR recovery", () => {
  const adminRoutes = read("src/routes/AdminRoutes.tsx");
  const invitePage = read("src/pages/church-admin/InviteMembersPage.tsx");
  const churchQrPage = read("src/pages/church-admin/ChurchQRPage.tsx");
  const payPage = read("src/pages/PayPage.tsx");
  const qrHelpers = read("src/lib/qr-payments.ts");

  it("restores member invitation as a dedicated church-admin route", () => {
    expect(adminRoutes).toContain('path="invite-members"');
    expect(adminRoutes).toContain("<InviteMembersPage />");
    expect(invitePage).toContain("buildMemberJoinUrl(church?.slug)");
    expect(invitePage).toContain("<QRCodeSVG");
  });

  it("makes invitation and QR giving discoverable in the admin mobile registry", () => {
    expect(
      STAFF_MOBILE_CONFIGS.admin.services.find((service) => service.id === "invite-members"),
    ).toMatchObject({
      label: "Alika Wanachama",
      route: "/church-admin/invite-members",
    });

    expect(
      STAFF_MOBILE_CONFIGS.admin.services.find((service) => service.id === "qr-payments"),
    ).toMatchObject({
      label: "Malipo ya QR",
      route: "/church-admin/qr-payments",
    });

    expect(
      STAFF_MOBILE_CONFIGS.finance.services.find((service) => service.id === "qr-payments"),
    ).toMatchObject({
      label: "Malipo ya QR",
      route: "/church-admin/qr-payments",
    });
  });

  it("does not fall back to demo churches or mock payments", () => {
    expect(qrHelpers).not.toContain("MOCK_CHURCHES");
    expect(qrHelpers).not.toContain("mockChurchPayment");
    expect(qrHelpers).not.toContain("getChurchPaymentProfile");
    expect(churchQrPage).not.toContain("abc123");
    expect(churchQrPage).toContain("isError || !church");
    expect(churchQrPage).toContain("buildChurchGivingUrl(church.id, church.slug)");
    expect(churchQrPage).not.toContain("churchId!");
    expect(payPage).not.toContain("fallbackChurch");
    expect(payPage).not.toContain("getChurchPaymentProfile");
  });

  it("keeps the real public giving RPC flow", () => {
    expect(payPage).toContain('"get_public_giving_church"');
    expect(payPage).toContain('"submit_public_contribution"');
    expect(qrHelpers).toContain("/give/${encodeURIComponent(target)}");
    expect(qrHelpers).toContain("parseChurchQRPayload");
  });
});

