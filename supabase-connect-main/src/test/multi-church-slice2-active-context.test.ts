import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

describe("multi-church slice 2 active church context", () => {
  const migration = read("supabase/migrations/20261004130000_active_church_context_rpc.sql");
  const sql = compact(migration);
  const auth = read("src/contexts/AuthContext.tsx");

  it("adds a new server-validated RPC without replacing the legacy context RPC", () => {
    expect(sql).toContain("create or replace function public.get_current_user_context_for_church( _requested_church_id uuid )");
    expect(sql).not.toContain("create or replace function public.get_current_user_context()");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("v_user_id uuid := auth.uid()");
    expect(sql).not.toMatch(/get_current_user_context_for_church\([^)]*(?:user_id|requested_user_id|p_user_id)/i);
    expect(sql).toContain("grant execute on function public.get_current_user_context_for_church(uuid) to authenticated");
  });

  it("builds available churches only from active canonical memberships for auth.uid", () => {
    expect(sql).toContain("from public.church_memberships cm join public.churches c on c.id = cm.church_id");
    expect(sql).toContain("where cm.user_id = v_user_id and cm.status = 'active'");
    expect(sql).toContain("'available_churches', v_available_churches");
    expect(sql).toContain("'membership_id', cm.id");
    expect(sql).toContain("'church_id', cm.church_id");
    expect(sql).toContain("'church_name', c.name");
    expect(sql).toContain("'church_code', c.church_code");
    expect(sql).toContain("'roles', role_context.roles");
    expect(sql).toContain("'baseline_member', member_context.baseline_member");
  });

  it("treats the requested church as a preference and falls back safely", () => {
    expect(sql).toContain("if _requested_church_id is not null and exists ( select 1 from public.church_memberships cm where cm.user_id = v_user_id and cm.church_id = _requested_church_id and cm.status = 'active' ) then v_church_id := _requested_church_id");
    expect(sql).toContain("where cm.user_id = v_user_id and cm.status = 'active' and cm.is_primary");
    expect(sql).toContain("and v_legacy_church_id is not null and exists ( select 1 from public.church_memberships cm where cm.user_id = v_user_id and cm.church_id = v_legacy_church_id and cm.status = 'active' ) then v_church_id := v_legacy_church_id");
    expect(sql).toContain("where cm.user_id = v_user_id and cm.status = 'active' order by cm.is_primary desc, cm.joined_at, cm.id limit 1");
    expect(sql).toContain("if v_church_id is null then v_church_id := v_legacy_church_id");
    expect(sql).not.toMatch(/begin\s+v_church_id\s*:=\s*_requested_church_id/i);
  });

  it("scopes role and member resolution to the selected active church", () => {
    expect(sql).toContain("where ur.user_id = v_user_id and ur.church_id = v_church_id");
    expect(sql).toContain("where m.user_id = v_user_id and m.church_id = v_church_id");
    expect(sql).toContain("'active_church_id', v_church_id");
    expect(sql).toContain("public.can_view_church_workspace(v_user_id, v_church_id)");
    expect(sql).toContain("public.can_manage_church_workspace(v_user_id, v_church_id)");
  });

  it("does not broaden table policies in slice 2", () => {
    expect(sql).not.toMatch(/\bcreate\s+policy\b|\balter\s+policy\b|\bdrop\s+policy\b/i);
    expect(sql).not.toMatch(/\balter\s+table\b[\s\S]{0,120}\bdisable\s+row\s+level\s+security\b/i);
  });

  it("exposes active church state in AuthContext and persists it per user", () => {
    expect(auth).toContain("availableChurches: AvailableChurch[]");
    expect(auth).toContain("activeChurchId: string | null");
    expect(auth).toContain("switchChurch: (churchId: string) => Promise<void>");
    expect(auth).toContain("setActiveChurch: (churchId: string) => Promise<void>");
    expect(auth).toContain("return `active-church:${userId}`");
    expect(auth).toContain("UUID_PATTERN");
    expect(auth).toContain("window.localStorage.removeItem(activeChurchStorageKey(userId))");
    expect(auth).toContain('rpc("get_current_user_context_for_church"');
    expect(auth).toContain("_requested_church_id: requestedChurchId");
    expect(auth).toContain("writeStoredActiveChurchId(target.id, nextChurch)");
    expect(auth).toContain("setActiveChurch: switchChurch");
  });

  it("keeps stale request protection and request dedup aware of requested church", () => {
    expect(auth).toContain("++sequence.current");
    expect(auth).toContain("isActiveAuthorizationLoad(loadSequence, sequence.current)");
    expect(auth).toContain("requestedChurchId: string | null");
    expect(auth).toContain("inFlight.current.requestedChurchId === requestedChurchId");
    expect(auth).toContain('reason: "SWITCH_CHURCH"');
    expect(auth).toContain("requestedChurchId: nextChurchId");
  });

  it("keeps workspace view church-scoped and does not turn switching into authorization", () => {
    expect(auth).toContain('`workspace-view:${userId}:${churchId ?? "no-church"}`');
    expect(auth).toContain("resolveStaffMobileWorkspace(authorization.roles, nextSuper)");
    expect(auth).toContain('const nextActiveView = nextWorkspace === "member" ? "member"');
    expect(auth).toContain("const canUseMemberView = !!member && !!churchId");
    expect(auth).toContain("const canUseStaffView = hasStaffWorkspace(staffWorkspace)");
    expect(auth).toContain("writeStoredWorkspaceView(user.id, churchId, nextView)");
  });
});
