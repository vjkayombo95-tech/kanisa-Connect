import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ").toLowerCase();

describe("multi-church slice 4 authorization hardening", () => {
  const migration = read("supabase/migrations/20261004140000_multi_church_authorization_hardening.sql");
  const normalized = normalize(migration);
  const memberJumuiya = read("src/lib/member-jumuiya.ts");
  const memberJumuiyaPage = read("src/pages/portal/MemberJumuiyaPage.tsx");

  it("adds an explicit church-scoped Jumuiya RPC and keeps caller identity server-derived", () => {
    expect(normalized).toContain("create or replace function public.get_my_jumuiya_assignments(_church_id uuid)");
    expect(normalized).toContain("v_actor uuid := auth.uid()");
    expect(normalized).not.toMatch(/_user_id|p_user_id|requested_user_id/);
    expect(normalized).toContain("where cm.user_id = v_actor and cm.church_id = _church_id and cm.status = 'active'");
    expect(normalized).toContain("where m.user_id = v_actor and m.church_id = _church_id");
  });

  it("does not use legacy current context for active-church Jumuiya resolution", () => {
    const explicitStart = normalized.indexOf("create or replace function public.get_my_jumuiya_assignments(_church_id uuid)");
    const wrapperStart = normalized.indexOf("create or replace function public.get_my_jumuiya_assignments()");
    const explicitFunction = normalized.slice(explicitStart, wrapperStart);

    expect(explicitFunction).not.toContain("get_current_user_context()");
    expect(explicitFunction).not.toContain("profiles.church_id");
    expect(explicitFunction).not.toContain("get_user_church_id()");
  });

  it("keeps no-argument compatibility but avoids arbitrary multi-church fallback", () => {
    expect(normalized).toContain("create or replace function public.get_my_jumuiya_assignments()");
    expect(normalized).toContain("select count(distinct cm.church_id)");
    expect(normalized).toContain(") > 1 then return");
    expect(normalized).toContain("from public.get_my_jumuiya_assignments(v_church_id)");
    expect(normalized).toContain("active-church clients should call get_my_jumuiya_assignments(uuid)");
  });

  it("uses active church from AuthContext when loading the member Jumuiya page", () => {
    expect(memberJumuiya).toContain("fetchMyJumuiyaAssignments(churchId: string)");
    expect(memberJumuiya).toContain('supabase.rpc("get_my_jumuiya_assignments" as never, { _church_id: churchId } as never)');
    expect(memberJumuiyaPage).toContain("queryFn: () => fetchMyJumuiyaAssignments(churchId!)");
    expect(memberJumuiyaPage).toContain("enabled: !!user?.id && !!churchId");
  });

  it("keeps pledge community leadership church-scoped", () => {
    expect(normalized).toContain("create or replace function public.is_pledge_leader_for_community(_community_id uuid)");
    expect(normalized).toContain("join public.communities c on c.id = _community_id and c.church_id = m.church_id");
    expect(normalized).toContain("where m.user_id = auth.uid()");
  });

  it("keeps grants narrow for changed SECURITY DEFINER functions", () => {
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = pg_catalog, public");
    expect(normalized).toContain("revoke all on function public.get_my_jumuiya_assignments(uuid) from public, anon, authenticated, service_role");
    expect(normalized).toContain("grant execute on function public.get_my_jumuiya_assignments(uuid) to authenticated");
    expect(normalized).toContain("revoke all on function public.is_pledge_leader_for_community(uuid) from public, anon, authenticated, service_role");
    expect(normalized).toContain("grant execute on function public.is_pledge_leader_for_community(uuid) to authenticated");
  });
});
