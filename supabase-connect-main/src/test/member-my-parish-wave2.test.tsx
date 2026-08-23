import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("Wave 2 My Parish", () => {
  const page = read("pages/portal/MemberMyParishPage.tsx");
  const helper = read("lib/member-daily-life.ts");
  const ministries = read("lib/member-ministries.ts");
  const linkedMember = read("hooks/use-linked-member.ts");

  it("renders production parish identity with a safe missing-logo fallback", () => {
    expect(helper).toContain('.select("id,name,logo_url,phone,email,address")');
    expect(page).toContain("parish.data.logoUrl ?");
    expect(page).toContain("<Church className");
  });

  it("uses the canonical tenant-keyed query for optional parish contact data", () => {
    expect(helper).toContain('["member-parish-identity", churchId]');
    expect(helper).toContain("data.id !== churchId");
    expect(helper).toContain("phone: normalizeParishContact(data.phone)");
    expect(helper).toContain("email: normalizeParishContact(data.email)");
    expect(helper).toContain("address: normalizeParishContact(data.address)");
    expect(page).toContain("enabled: !!churchId");
    expect(page).not.toContain("metadata");
  });

  it("keeps member and parish data tenant scoped", () => {
    expect(helper).toContain('.eq("id", churchId)');
    expect(helper).toContain("row.church_id === churchId");
    expect(linkedMember).toContain('.eq("user_id", user.id)');
    expect(linkedMember).toContain('.eq("church_id", churchId)');
    expect(page).toContain("useLinkedMember()");
    expect(ministries).toContain('.eq("church_id", churchId)');
    expect(page).toContain("memberMinistriesQueryKey(churchId, member.data?.id)");
  });

  it("uses fail-closed production media components", () => {
    expect(page).toContain("presentation(livestream.data)");
    expect(page).toContain("getYouTubeEmbedUrl(livestream.data)");
    expect(page).toContain("livestream.data.churchId === livestream.churchId");
    expect(page).toContain("radio.featureEnabled && !radio.isError && radio.data.length");
    expect(page).toContain('to="/portal/radio"');
  });

  it("links existing task routes without adding summary mutations", () => {
    for (const route of ["/portal/give", "/portal/mass-intentions", "/portal/prayer-requests", "/portal/sermons", "/portal/calendar", "/portal/library"]) {
      expect(page).toContain(`to="${route}"`);
    }
    expect(page).not.toMatch(/useMutation|\.insert\(|\.update\(|\.delete\(/);
  });
});
