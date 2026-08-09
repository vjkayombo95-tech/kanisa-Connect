import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function functionBody(sql: string, functionName: string) {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = sql.slice(start);
  const end = rest.indexOf("\ngrant ");
  return end >= 0 ? rest.slice(0, end) : rest;
}

describe("RC-2.9.2 paid event registration RPC schema compatibility", () => {
  const baseline = read("supabase/migrations/20260622000000_production_baseline.sql");
  const paidMigration = read("supabase/migrations/20260704134000_paid_event_registration.sql");
  const fix = read("supabase/migrations/20260704136000_fix_paid_event_registration_rpc.sql");
  const registerBody = functionBody(fix, "register_for_event");

  it("documents that the baseline events schema has archived_at but no status column", () => {
    const eventsTable = baseline.slice(
      baseline.indexOf("CREATE TABLE public.events"),
      baseline.indexOf("-- Name: families; Type: TABLE"),
    );

    expect(eventsTable).toContain("archived_at timestamp with time zone");
    expect(eventsTable).not.toContain("status");
  });

  it("replaces the crashing register_for_event implementation without v_event.status", () => {
    expect(paidMigration).toContain("coalesce(v_event.status, 'upcoming')");
    expect(fix).toContain("create or replace function public.register_for_event");
    expect(registerBody).not.toContain("v_event.status");
    expect(registerBody).toContain("and archived_at is null");
  });

  it("keeps every v_event field reference aligned to the migration chain", () => {
    for (const field of [
      "id",
      "church_id",
      "registration_deadline",
      "registration_capacity",
      "registration_type",
      "registration_fee",
      "registration_currency",
    ]) {
      expect(registerBody).toContain(`v_event.${field}`);
    }

    expect(read("supabase/migrations/20260704134000_paid_event_registration.sql")).toContain("add column if not exists registration_deadline");
    expect(read("supabase/migrations/20260704134000_paid_event_registration.sql")).toContain("add column if not exists registration_capacity");
    expect(read("supabase/migrations/20260704134000_paid_event_registration.sql")).toContain("add column if not exists registration_type");
  });

  it("preserves member, audience, deadline, capacity, and duplicate-registration checks", () => {
    expect(registerBody).toContain("if not public.can_view_event(auth.uid(), v_event.id) then");
    expect(registerBody).toContain("m.church_id = v_event.church_id");
    expect(registerBody).toContain("v_event.registration_deadline is not null and now() > v_event.registration_deadline");
    expect(registerBody).toContain("v_existing.id is null and v_event.registration_capacity is not null");
    expect(registerBody).toContain("on conflict (event_id, member_id) do update");
  });

  it("keeps free and paid registration states distinct without approving payment during registration", () => {
    expect(registerBody).toContain("v_is_paid := coalesce(v_event.registration_type, 'free') = 'paid'");
    expect(registerBody).toContain("v_registration_status := 'payment_pending'");
    expect(registerBody).toContain("v_payment_status := 'pending'");
    expect(registerBody).toContain("v_registration_status := 'confirmed'");
    expect(registerBody).toContain("v_payment_status := 'not_required'");
    expect(registerBody).not.toContain("v_payment_status := 'paid'");
  });

  it("keeps payment submission and review RPC field assumptions on their own tables", () => {
    const submitBody = functionBody(paidMigration, "submit_event_registration_payment");
    const reviewBody = functionBody(paidMigration, "review_event_registration_payment");

    expect(submitBody).toContain("v_attendance.payment_status");
    expect(submitBody).toContain("v_attendance.amount_due");
    expect(submitBody).toContain("v_attendance.currency");
    expect(submitBody).toContain("v_event.registration_type");
    expect(submitBody).not.toContain("v_event.status");

    expect(reviewBody).toContain("v_payment.church_id");
    expect(reviewBody).toContain("v_payment.status");
    expect(reviewBody).toContain("v_payment.attendance_id");
    expect(reviewBody).not.toContain("v_event.");
  });

  it("keeps members from reviewing their own event payment", () => {
    const reviewBody = functionBody(paidMigration, "review_event_registration_payment");

    expect(reviewBody).toContain("public.can_manage_church_roles(auth.uid(), v_payment.church_id)");
    expect(reviewBody).toContain("public.can_manage_church_workspace(auth.uid(), v_payment.church_id)");
    expect(reviewBody).not.toContain("m.user_id = auth.uid()");
  });
});
