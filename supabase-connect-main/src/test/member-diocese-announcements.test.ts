import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
  },
}));

import { fetchMemberDioceseAnnouncements } from "@/lib/member-diocese-announcements";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("member Diocese announcements Slice 5B", () => {
  const migration = read("supabase/migrations/20261012120000_member_diocese_announcements.sql");
  const sqlTest = read("supabase/tests/member_diocese_announcements_security.sql");
  const service = read("src/lib/member-diocese-announcements.ts");
  const portalPage = read("src/pages/portal/PortalAnnouncements.tsx");
  const dashboard = read("src/pages/portal/PortalDashboard.tsx");
  const authContext = read("src/contexts/AuthContext.tsx");
  const en = JSON.parse(read("src/locales/en.json"));
  const sw = JSON.parse(read("src/locales/sw.json"));

  beforeEach(() => {
    state.rpc.mockReset();
  });

  it("calls only the caller-bound member delivery RPC with the current church id", async () => {
    const rows = [
      {
        id: "diocese-announcement-a",
        diocese_id: "diocese-a",
        church_id: "church-a",
        diocese_name: "Diocese A",
        title: "Diocese update",
        content: "Read-only member content",
        published_at: "2026-10-12T12:00:00Z",
        created_at: "2026-10-12T12:00:00Z",
        updated_at: "2026-10-12T12:00:00Z",
        target_mode: "all_parishes",
        source: "diocese",
      },
    ];
    state.rpc.mockResolvedValue({ data: rows, error: null });

    await expect(fetchMemberDioceseAnnouncements("church-a", 7)).resolves.toEqual(rows);

    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith("get_member_diocese_announcements", {
      _church_id: "church-a",
      _limit: 7,
    });
  });

  it("keeps the database contract separate from parish portal announcements", () => {
    expect(migration).toContain("create or replace function public.get_member_diocese_announcements");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("from public.church_memberships cm");
    expect(migration).toContain("from public.members m");
    expect(migration).toContain("m.user_id = v_actor");
    expect(migration).toContain("dc.church_id = _church_id");
    expect(migration).toContain("d.status = 'active'");
    expect(migration).toContain("dc.status = 'active'");
    expect(migration).toContain("da.status = 'published'");
    expect(migration).toContain("da.archived_at is null");
    expect(migration).toContain("least(greatest(coalesce(_limit, 50), 1), 100)");
    expect(migration).toContain("grant execute on function public.get_member_diocese_announcements(uuid, integer)");

    expect(migration).not.toContain("current_user_can_view_diocese");
    expect(migration).not.toContain("current_user_can_manage_diocese");
    expect(migration).not.toContain("is_diocese_staff");
    expect(migration).not.toContain("v_user_email");
    expect(migration).not.toContain("auth.users");
    expect(migration).not.toContain("lower(trim(m.email))");
    expect(migration).not.toContain("get_portal_announcements");
    expect(migration).not.toContain("announcement_reactions");
    expect(migration).not.toContain("announcement_comments");
  });

  it("covers member delivery security scenarios in SQL", () => {
    const requiredSignals = [
      "Parish A member receives a published all-parishes Diocese A announcement",
      "Parish A member receives a published selected-parishes announcement targeting Parish A",
      "Email-matched active parish member row without matching user_id does not authorize Diocese announcement delivery",
      "Active canonical church_memberships row authorizes Diocese announcement delivery",
      "Active members row linked by user_id authorizes Diocese announcement delivery",
      "Inactive members row without active canonical membership does not authorize Diocese announcement delivery",
      "Multi-church member retrieves the correct Diocese announcement set for each authorized church",
      "Parish B member does not receive a Parish-A-only selected announcement",
      "Parish A member cannot request Parish B unless independently authorized there",
      "Diocese staff without legitimate Parish A member access receives no member-delivery data",
      "Inactive Diocese-church relationship returns no Diocese announcements",
      "Inactive Diocese returns no Diocese announcements",
      "Draft, archived, and wrong-church selected Diocese announcements are excluded",
      "Selected target must match announcement Diocese defensively",
      "anon cannot execute the member Diocese announcement RPC",
      "authenticated can execute the member Diocese announcement RPC",
      "internal Diocese helper privileges remain unchanged",
      "creates no church_memberships or user_roles for Diocese staff",
      "Diocese staff remains non-church-admin",
    ];

    for (const signal of requiredSignals) {
      expect(sqlTest).toContain(signal);
    }
  });

  it("uses source-aware member presentation and keeps Diocese rows read-only", () => {
    expect(portalPage).toContain('source: "parish"');
    expect(portalPage).toContain('source: "diocese"');
    expect(portalPage).toContain("sourceKey: `parish:${announcement.id}`");
    expect(portalPage).toContain("sourceKey: `diocese:${announcement.id}`");
    expect(portalPage).toContain("fetchMemberDioceseAnnouncements(churchId, 25)");
    expect(portalPage).toContain('queryKey: ["portal-announcements-all", user?.id, churchId]');
    expect(portalPage).toContain('announcement.source === "parish" && announcement.isCelebration');
    expect(portalPage).toContain('announcement.source === "diocese"');
    expect(portalPage).toContain('t("member_announcements.badges.diocese")');
    expect(portalPage).toContain("Promise.allSettled");
    expect(portalPage).toContain("Diocese announcements unavailable; showing parish announcements only.");

    const reactionIdSet = portalPage.slice(
      portalPage.indexOf("const celebrationRows"),
      portalPage.indexOf("if (announcementIds.length === 0)"),
    );
    expect(reactionIdSet).toContain("announcementRows.filter");
    expect(reactionIdSet).not.toContain("dioceseRows");
  });

  it("includes Diocese announcements in the dashboard preview without changing church context semantics", () => {
    expect(dashboard).toContain("fetchMemberDioceseAnnouncements(churchId, 3)");
    expect(dashboard).toContain('queryKey: ["dash-announcements", churchId]');
    expect(dashboard).toContain("mergeDashboardAnnouncements");
    expect(dashboard).toContain("sourceKey: `diocese:${announcement.id}`");
    expect(dashboard).toContain('t("member_announcements.badges.diocese")');
    expect(dashboard).toContain("Diocese announcements unavailable; showing parish dashboard announcements only.");

    const memberSources = [service, portalPage, dashboard].join("\n");
    expect(memberSources).not.toContain("DioceseWorkspaceContext");
    expect(memberSources).not.toContain("useDioceseWorkspace");
    expect(memberSources).not.toContain("getMyDioceseWorkspaces");
    expect(authContext).not.toContain("activeDioceseId");
    expect(authContext).toContain("switchChurch");
  });

  it("localizes the Diocese source indicator", () => {
    expect(en.member_announcements.badges.diocese).toBe("Diocese");
    expect(sw.member_announcements.badges.diocese).toBe("Diocese");
  });
});
