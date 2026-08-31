import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831100000_add_saint_provenance_import_rpc.sql"),
  "utf8",
);

const sqlTest = readFileSync(join(process.cwd(), "supabase/tests/saint_provenance_import.sql"), "utf8");
const todayPage = readFileSync(join(process.cwd(), "src/pages/portal/MemberTodayPage.tsx"), "utf8");

describe("saint provenance foundation migration", () => {
  it("creates the provenance table with source identity and lifecycle columns", () => {
    expect(migration).toContain("create table if not exists public.saint_provenance");
    expect(migration).toContain("saint_id uuid not null references public.saints(id) on delete cascade");
    expect(migration).toContain("translation_language_code text null");
    expect(migration).toContain("source_checked_date date not null");
    expect(migration).toContain("editorial_approval_date date not null");
    expect(migration).toContain("created_by uuid references auth.users(id) on delete set null");
    expect(migration).toContain("updated_by uuid references auth.users(id) on delete set null");
    expect(migration).toContain("created_at timestamptz not null default now()");
    expect(migration).toContain("updated_at timestamptz not null default now()");
  });

  it("allows only approved provenance source roles", () => {
    for (const role of ["factual_reference", "quote_source", "image_source", "translation_reference", "license_record"]) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain("constraint saint_provenance_source_role_check");
  });

  it("adds indexes, duplicate protection, and the repository updated_at trigger", () => {
    expect(migration).toContain("saint_provenance_saint_id_idx");
    expect(migration).toContain("saint_provenance_saint_language_idx");
    expect(migration).toContain("saint_provenance_source_role_idx");
    expect(migration).toContain("saint_provenance_source_checked_date_idx");
    expect(migration).toContain("create unique index if not exists saint_provenance_identity_idx");
    expect(migration).toContain("coalesce(translation_language_code, '')");
    expect(migration).toContain("execute function public.update_updated_at_column()");
  });

  it("keeps provenance access limited to platform or super admins", () => {
    expect(migration).toContain("alter table public.saint_provenance enable row level security");
    expect(migration).toContain("revoke all on table public.saint_provenance from public, anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on public.saint_provenance to authenticated");
    expect(migration).toContain("public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())");
    expect(migration).not.toMatch(/church_admin|pastor|secretary|treasurer/);
  });

  it("creates a locked-down atomic canonical import RPC", () => {
    expect(migration).toContain("create or replace function public.import_canonical_saints(_payload jsonb)");
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("raise exception 'Super Admin access required'");
    expect(migration).toContain("revoke all on function public.import_canonical_saints(jsonb) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.import_canonical_saints(jsonb) to authenticated");
    expect(migration).not.toMatch(/execute\s+format|dynamic sql/i);
  });

  it("validates canonical JSON before writes and returns stable summary counts", () => {
    expect(migration).toContain("Canonical saints payload requires a non-empty saints array");
    expect(migration).toContain("Duplicate saint slug in payload");
    expect(migration).toContain("has an invalid feast date");
    expect(migration).toContain("has an invalid liturgical_rank");
    expect(migration).toContain("Duplicate translation language for saint");
    expect(migration).toContain("requires at least one provenance entry");
    expect(migration).toContain("if v_source_role is null");
    expect(migration).toContain("has an invalid provenance source_role");
    expect(migration).toContain("provenance is missing required values");
    expect(migration).toContain("'saints_processed', v_saints_processed");
    expect(migration).toContain("'translations_processed', v_translations_processed");
    expect(migration).toContain("'provenance_processed', v_provenance_processed");
  });

  it("validates recurring feast dates with leap-day support", () => {
    expect(migration).not.toContain("make_date(2026");
    expect(migration).toContain("make_date(2024, v_feast_month, 1)");
    expect(migration).toContain("or v_feast_day < 1");
    expect(migration).toContain("if v_feast_day > extract(day from (");
    expect(sqlTest).toContain("February 29 is accepted as a valid recurring feast date");
    expect(sqlTest).toContain("February 30 rejected");
    expect(sqlTest).toContain("April 31 rejected");
    expect(sqlTest).toContain("valid canonical payload succeeds");
  });

  it("upserts saints, translations, and provenance by approved identities", () => {
    expect(migration).toContain("on conflict (slug) do update set");
    expect(migration).toContain("on conflict (saint_id, language_code) do update set");
    expect(migration).toContain("on conflict (");
    expect(migration).toContain("(coalesce(translation_language_code, ''))");
    expect(migration).toContain("(coalesce(source_publication, ''))");
    expect(migration).toContain("(coalesce(source_url, ''))");
  });
});

describe("saint provenance SQL test coverage", () => {
  it("covers security, idempotency, rollback, and Today/Leo compatibility", () => {
    expect(sqlTest).toContain("ordinary authenticated caller rejected");
    expect(sqlTest).toContain("valid canonical payload succeeds");
    expect(sqlTest).toContain("repeated same payload is idempotent");
    expect(sqlTest).toContain("multiple factual sources are supported");
    expect(sqlTest).toContain("base provenance with null translation language is supported");
    expect(sqlTest).toContain("translation provenance is supported");
    expect(sqlTest).toContain("blank provenance source role rejected by prevalidation");
    expect(sqlTest).toContain("missing provenance source role rejected before writes");
    expect(sqlTest).toContain("invalid later source role rolls back earlier saint");
    expect(sqlTest).toContain("invalid second saint causes first saint write to roll back");
    expect(sqlTest).toContain("ordinary member cannot read saint provenance rows");
    expect(sqlTest).toContain("ordinary authenticated caller cannot write saint provenance");
    expect(sqlTest).toContain("without changing Today/Leo query contracts");
  });

  it("leaves the member Today/Leo saint query unchanged", () => {
    expect(todayPage).toContain('from("saints" as never)');
    expect(todayPage).toContain('.eq("is_active", true)');
    expect(todayPage).toContain('.eq("feast_month", today.getMonth() + 1)');
    expect(todayPage).toContain('.eq("feast_day", today.getDate())');
    expect(todayPage).not.toContain("saint_provenance");
    expect(todayPage).not.toContain("import_canonical_saints");
  });
});
