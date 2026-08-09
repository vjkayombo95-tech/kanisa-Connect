import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(path.resolve(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("RC-2.9.1 event SELECT RLS regression guard", () => {
  const fix = migration("20260704135000_fix_event_select_rls_regression.sql");
  const paidRegistration = migration("20260704134000_paid_event_registration.sql");

  it("replaces the recursive events SELECT predicate with a row-scoped helper", () => {
    expect(fix).toContain("create or replace function public.can_view_event_for_row");
    expect(fix).toContain('drop policy if exists "Authorized users can select targeted events" on public.events');
    expect(fix).toContain("public.can_view_event_for_row(");
    expect(fix).not.toContain("public.can_view_event(auth.uid(), id)");
  });

  it("keeps the row helper from querying public.events inside the events RLS path", () => {
    const helperBody = fix.slice(
      fix.indexOf("create or replace function public.can_view_event_for_row"),
      fix.indexOf("create or replace function public.can_view_event(_user_id uuid, _event_id uuid)"),
    );

    expect(helperBody).not.toContain("from public.events");
    expect(helperBody).toContain("from public.members m");
    expect(helperBody).toContain("from public.event_audience_targets eat");
    expect(helperBody).toContain("public.can_manage_church_roles(_user_id, _church_id)");
  });

  it("keeps member audience targeting without recursive target policy calls", () => {
    expect(fix).toContain('drop policy if exists "Event audience targets visible with event access"');
    expect(fix).toContain('create policy "Event audience targets visible to authorized members"');
    expect(fix).toContain("event_audience_targets.ministry_id");
    expect(fix).toContain("event_audience_targets.community_id");

    const targetPolicy = fix.slice(fix.indexOf('create policy "Event audience targets visible to authorized members"'));
    expect(targetPolicy).not.toContain("public.can_view_event(auth.uid(), event_id)");
  });

  it("preserves paid registration RPC authorization through can_view_event", () => {
    expect(paidRegistration).toContain("if not public.can_view_event(auth.uid(), v_event.id) then");
    expect(fix).toContain("grant execute on function public.can_view_event(uuid, uuid) to authenticated");
  });
});
