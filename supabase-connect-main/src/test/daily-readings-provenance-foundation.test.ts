import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function blockStartingAt(sql: string, start: string) {
  const index = sql.toLowerCase().indexOf(start.toLowerCase());
  if (index < 0) return "";
  return normalizeSql(sql.slice(index));
}

const migration = read("supabase/migrations/20260907150000_daily_readings_provenance_foundation.sql");
const normalized = normalizeSql(migration);
const visibilityHardening = normalizeSql(read("supabase/migrations/20260907140000_harden_daily_readings_member_visibility.sql"));
const canonicalRpc = normalizeSql(read("supabase/migrations/20260907130000_get_member_daily_reading.sql"));

describe("Daily Readings provenance and idempotency foundation", () => {
  it("adds current source provenance fields without replacing existing CMS provenance", () => {
    expect(normalized).toContain("alter table public.content_daily_readings add column if not exists source_key text");
    expect(normalized).toContain("add column if not exists source_record_id text");
    expect(normalized).toContain("add column if not exists source_version text");
    expect(normalized).toContain("add column if not exists source_url text");
    expect(normalized).toContain("add column if not exists last_imported_source_hash text");
    expect(normalized).toContain("add column if not exists last_imported_at timestamptz");
    expect(normalized).toContain("add column if not exists last_import_item_id uuid");
    expect(normalized).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?source_attribution/i);
    expect(normalized).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?import_batch_id/i);
    expect(normalized).not.toMatch(/alter\s+table\s+public\.content_daily_readings\s+alter\s+column\s+language_id\s+set\s+not\s+null/i);
  });

  it("keeps historical/manual rows valid while preventing partial source identity", () => {
    const constraint = blockStartingAt(migration, "add constraint content_daily_readings_source_identity_pair_check");

    expect(constraint).toContain("check");
    expect(constraint).toContain("source_key is null and source_record_id is null");
    expect(constraint).toContain("source_key is not null and source_record_id is not null");
  });

  it("requires imported Daily Readings source identity to use a concrete language", () => {
    const constraint = blockStartingAt(migration, "add constraint content_daily_readings_imported_language_check");

    expect(constraint).toContain("check");
    expect(constraint).toContain("source_key is null");
    expect(constraint).toContain("source_record_id is null");
    expect(constraint).toContain("language_id is not null");
  });

  it("stores one current CMS target per imported source identity", () => {
    expect(normalized).toContain("create unique index if not exists content_daily_readings_source_identity_unique");
    expect(normalized).toContain("on public.content_daily_readings(source_key, source_record_id)");
    expect(normalized).toContain("where source_key is not null and source_record_id is not null");
  });

  it("creates a compact import item ledger with batch and language foreign keys", () => {
    expect(normalized).toContain("create table if not exists public.content_import_items");
    expect(normalized).toContain("id uuid primary key default gen_random_uuid()");
    expect(normalized).toContain("import_batch_id uuid not null references public.content_import_batches(id) on delete cascade");
    expect(normalized).toContain("language_id uuid references public.content_languages(id) on delete set null");
    expect(normalized).toContain("source_hash text not null");
    expect(normalized).toContain("source_payload jsonb");
    expect(normalized).toContain("target_table text");
    expect(normalized).toContain("target_record_id uuid");
    expect(normalized).not.toMatch(/foreign\s+key\s*\(\s*target_record_id\s*\)/i);
  });

  it("limits row outcomes to completed import attempt states", () => {
    expect(normalized).toContain("check (status in ('imported', 'skipped', 'conflict', 'failed'))");
    expect(normalized).not.toContain("'pending'");
  });

  it("prevents duplicate source item processing inside one batch while allowing cross-batch history", () => {
    expect(normalized).toContain("unique (import_batch_id, content_type, source_key, source_record_id)");
    expect(normalized).not.toMatch(/unique\s*\(\s*content_type\s*,\s*source_key\s*,\s*source_record_id\s*\)/i);
    expect(normalized).toContain("create index if not exists idx_content_import_items_source_identity");
    expect(normalized).toContain("on public.content_import_items(content_type, source_key, source_record_id)");
  });

  it("adds useful lookup indexes without replacing batch-level history", () => {
    expect(normalized).toContain("idx_content_import_items_batch_status");
    expect(normalized).toContain("on public.content_import_items(import_batch_id, status)");
    expect(normalized).toContain("idx_content_import_items_target");
    expect(normalized).toContain("on public.content_import_items(target_table, target_record_id)");
    expect(normalized).toContain("idx_content_import_items_reading_language");
    expect(normalized).toContain("on public.content_import_items(reading_date, language_id)");
    expect(normalized).toContain("idx_content_import_items_source_hash");
    expect(normalized).toContain("on public.content_import_items(source_hash)");
    expect(normalized).not.toMatch(/alter\s+table\s+public\.content_import_batches\s+drop/i);
  });

  it("links CMS rows to the ledger without making CMS content depend on ledger retention", () => {
    expect(normalized).toContain("add constraint content_daily_readings_last_import_item_id_fkey");
    expect(normalized).toContain("foreign key (last_import_item_id)");
    expect(normalized).toContain("references public.content_import_items(id)");
    expect(normalized).toContain("on delete set null");
  });

  it("enables import-item RLS for super-admin management only", () => {
    expect(normalized).toContain("alter table public.content_import_items enable row level security");
    expect(normalized).toContain('create policy "super admins manage cms import items"');
    expect(normalized).toContain("on public.content_import_items for all to authenticated");
    expect(normalized).toContain("public.is_platform_super_admin(auth.uid()) or public.is_super_admin(auth.uid())");
    expect(normalized).toContain("revoke all on table public.content_import_items from public, anon, authenticated");
    expect(normalized).toContain("grant select, insert, update, delete on public.content_import_items to authenticated");
    expect(normalized).not.toMatch(/for\s+select\s+to\s+anon/i);
    expect(normalized).not.toMatch(/for\s+select\s+to\s+authenticated\s+using\s*\(\s*true\s*\)/i);
    expect(normalized).not.toMatch(/church_admin|pastor|secretary|church_staff/i);
  });

  it("documents normalized source hash semantics without calculating hashes in the database", () => {
    expect(normalized).toContain("deterministic hash of normalized source-controlled payload");
    expect(normalized).toContain("excludes status, visibility, editorial notes, database uuids, timestamps, and import batch identity");
    expect(normalized).not.toMatch(/digest\s*\(/i);
    expect(normalized).not.toMatch(/encode\s*\(\s*digest/i);
    expect(normalized).not.toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\..*hash/i);
  });

  it("preserves existing content_versions capture behavior", () => {
    expect(normalized).not.toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.capture_content_daily_reading_version/i);
    expect(normalized).not.toMatch(/drop\s+trigger\s+if\s+exists\s+capture_content_daily_reading_version/i);
    expect(normalized).not.toMatch(/alter\s+table\s+public\.content_versions/i);
  });

  it("does not change the canonical member RPC or 10D-3B visibility policy", () => {
    expect(canonicalRpc).toContain("create or replace function public.get_member_daily_reading(p_reading_date date)");
    expect(canonicalRpc).toContain("cdr.status in ('published', 'featured')");
    expect(canonicalRpc).toContain("cdr.visibility in ('public', 'member')");
    expect(normalized).not.toMatch(/get_member_daily_reading/i);

    expect(visibilityHardening).toContain('drop policy if exists "authenticated users can read published cms daily readings" on public.content_daily_readings');
    expect(visibilityHardening).toContain('create policy "authenticated users can read member-visible cms daily readings"');
    expect(visibilityHardening).toContain("status in ('published', 'featured') and visibility in ('public', 'member')");
    expect(normalized).not.toContain('authenticated users can read member-visible cms daily readings');
  });

  it("does not implement importer execution, automatic publication, or scripture text storage", () => {
    expect(normalized).not.toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.apply_.*daily.*import/i);
    expect(normalized).not.toMatch(/grant\s+execute/i);
    expect(normalized).not.toMatch(/status\s*=\s*'published'|status\s*=\s*'featured'/i);
    expect(normalized).not.toMatch(/scripture_text|first_reading_text|gospel_text|passage_text/i);
  });
});
