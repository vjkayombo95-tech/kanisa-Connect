import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isOrdinaryMemberPathAllowed, memberServiceRegistry } from "@/lib/member-service-registry";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const communityHelp = read("src/pages/portal/PortalCommunityHelp.tsx");
const portalDashboard = read("src/pages/portal/PortalDashboard.tsx");
const portalLayout = read("src/components/portal/PortalLayout.tsx");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe("Wave G1 member Community Help localization", () => {
  it("uses member_community_help translation keys for app-owned Community Help UI", () => {
    for (const key of [
      "member_community_help.title",
      "member_community_help.description",
      "member_community_help.actions.request_help",
      "member_community_help.form.category_label",
      "member_community_help.form.description_placeholder",
      "member_community_help.offline.pending_title",
      "member_community_help.tabs.community_requests",
      "member_community_help.states.empty_approved",
      "member_community_help.donation.platform_fee_label",
      "member_community_help.comments.placeholder",
    ]) {
      expect(communityHelp).toContain(key);
    }

    for (const staleLiteral of [
      ">Community Help<",
      ">Request Help<",
      ">Community Requests<",
      ">Loading...</p>",
      ">Donate to Help Request<",
      "placeholder=\"Describe the need...\"",
      "placeholder=\"Select category\"",
      "No approved help requests at this time.",
    ]) {
      expect(communityHelp).not.toContain(staleLiteral);
    }
  });

  it("keeps English and Swahili member_community_help locale structures symmetric", () => {
    expect(flattenKeys(en.member_community_help).sort()).toEqual(flattenKeys(sw.member_community_help).sort());
  });

  it("preserves canonical category values while localizing category display", () => {
    expect(communityHelp).toContain('const helpCategories = ["Medical", "Education", "Housing", "Food", "Emergency", "Funeral", "Other"]');
    expect(communityHelp).toContain("<SelectItem key={value} value={value}>{translateHelpCategory(t, value)}</SelectItem>");
    expect(communityHelp).toContain('category: category || "other"');
    expect(communityHelp).toContain("translateHelpCategory(t, request.category)");
    expect(communityHelp).not.toContain("value={value.toLowerCase()}");
  });

  it("preserves canonical status, query, mutation, and offline identifiers", () => {
    for (const identifier of [
      'status === "approved"',
      'status === "pending"',
      '"community_help_request_create"',
      '"portal-community-help-approved"',
      '"my-help-requests"',
      '"my-help-requests-dashboard"',
      '"community-help"',
      "processOfflineSyncQueue(queryClient)",
    ]) {
      expect(communityHelp).toContain(identifier);
    }

    expect(communityHelp).toContain("translateStatus(t, request.status)");
    expect(communityHelp).not.toContain('status = t("');
  });

  it("keeps Community Help deferred and hidden from ordinary member surfaces", () => {
    expect(memberServiceRegistry.some((item) => item.path === "/portal/community-help")).toBe(false);
    expect(isOrdinaryMemberPathAllowed("/portal/community-help")).toBe(false);
    expect(isOrdinaryMemberPathAllowed("/member/community-help")).toBe(false);
    expect(portalDashboard).not.toContain("useMemberHelpRequests");
    expect(portalDashboard).not.toContain('to="/portal/community-help"');
    expect(portalDashboard).not.toContain('label="Omba Msaada"');
    expect(portalLayout).toContain("simpleMemberRouteHidden || explicitFeatureUnavailable");
  });

  it("does not route dynamic member, request, or comment content through translation", () => {
    for (const dynamicExpression of [
      "{member.full_name}",
      "{request.member_name}",
      "{request.description}",
      "{item.payload.description}",
      "body: comment.comment",
    ]) {
      expect(communityHelp).toContain(dynamicExpression);
    }

    expect(communityHelp).not.toContain("t(request.description");
    expect(communityHelp).not.toContain("t(comment.comment");
    expect(communityHelp).not.toContain("t(member.full_name");
  });

  it("uses the localized date helper for displayed Community Help dates", () => {
    expect(communityHelp).toContain("formatAppDate(item.createdAt, i18n.language");
    expect(communityHelp).toContain("formatAppDate(request.created_at, i18n.language");
    expect(communityHelp).not.toContain("new Date(request.created_at).toLocaleDateString()");
    expect(communityHelp).not.toContain("new Date(item.createdAt).toLocaleString()");
  });
});
