import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Wave 12 Slice 3 member Jumuiya legacy hardening", () => {
  const dashboard = read("src/pages/portal/PortalDashboard.tsx");

  it("keeps assigned Jumuiya display read-only on the legacy dashboard", () => {
    expect(dashboard).toContain('label="Jumuiya / Community"');
    expect(dashboard).toContain("value={community?.name ?? null}");
    expect(dashboard).not.toContain("Edit Jumuiya");
    expect(dashboard).not.toContain("Change Jumuiya");
    expect(dashboard).not.toContain("Leave Jumuiya");
    expect(dashboard).not.toContain("Select your Jumuiya");
    expect(dashboard).not.toContain("Choose Jumuiya");
  });

  it("removes member-side community assignment mutations from the dashboard", () => {
    expect(dashboard).not.toContain('from("member_communities").delete().eq("member_id"');
    expect(dashboard).not.toContain('from("member_communities").insert({ community_id: selectedCommunity');
    expect(dashboard).not.toContain("JumuiyaInvolvementCard");
    expect(dashboard).not.toContain("selectedCommunity");
    expect(dashboard).not.toContain("setSelectedCommunity");
  });

  it("uses truthful loading, error, retry, and not-assigned states", () => {
    expect(dashboard).toContain("Tunaangalia taarifa ya Jumuiya yako...");
    expect(dashboard).toContain("Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");
    expect(dashboard).toContain("Jaribu tena");
    expect(dashboard).toContain("Jumuiya yako bado haijawekwa. Wasiliana na ofisi ya parokia ili kusasisha taarifa hii.");
    expect(dashboard).not.toContain("Assignment request noted");
    expect(dashboard).not.toContain("Request Assignment");
  });

  it("hides raw lookup errors and does not render internal assignment identifiers", () => {
    expect(dashboard).not.toContain("communityError.message");
    expect(dashboard).not.toContain("community?.id");
    expect(dashboard).not.toContain("value={community?.id");
    expect(dashboard).not.toContain("Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.{");
  });

  it("keeps community lookup scoped to the member church and preserves first-link behavior", () => {
    expect(dashboard).toContain('.eq("id", member.community_id)');
    expect(dashboard).toContain('.eq("church_id", member.church_id)');
    expect(dashboard).toContain(".limit(1)");
    expect(dashboard).toContain("linkedCommunity?.church_id === member.church_id ? linkedCommunity : null");
  });

  it("does not alter pledges, contributions, channels, or staff assignment surfaces", () => {
    expect(read("src/pages/portal/PortalPledges.tsx")).toContain('.from("member_communities")');
    expect(read("src/lib/pledges.ts")).toContain('_community_id: communityId ?? null');
    expect(read("src/components/channels/ChannelWorkspace.tsx")).toContain('scope === "member"');
    expect(read("src/pages/church-admin/CommunitiesPage.tsx")).toContain('.from("member_communities")');
    expect(read("src/components/MemberForm.tsx")).toContain('.from("member_communities").delete().eq("member_id", member.id)');
    expect(read("src/pages/community-leader/CommunityMembersPage.tsx")).toContain('.from("member_communities")');
  });
});
