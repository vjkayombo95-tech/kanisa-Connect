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

const metadataMigration = read("supabase/migrations/20260907160000_daily_readings_import_metadata.sql");
const foundationMigration = read("supabase/migrations/20260907150000_daily_readings_provenance_foundation.sql");
const visibilityHardening = read("supabase/migrations/20260907140000_harden_daily_readings_member_visibility.sql");
const canonicalRpc = read("supabase/migrations/20260907130000_get_member_daily_reading.sql");

const metadata = normalizeSql(metadataMigration);
const foundation = normalizeSql(foundationMigration);
const visibility = normalizeSql(visibilityHardening);
const rpc = normalizeSql(canonicalRpc);

describe("Daily Readings import metadata support", () => {
  it("adds nullable machine-readable error metadata without changing error_message", () => {
    expect(metadata).toContain("alter table public.content_import_items add column if not exists error_code text");
    expect(metadata).toContain("stable machine-readable classification");
    expect(metadata).toContain("human-readable diagnostics remain in error_message");
    expect(metadata).not.toMatch(/alter\s+table\s+public\.content_import_items\s+alter\s+column\s+error_code\s+set\s+not\s+null/i);
    expect(metadata).not.toMatch(/error_code\s+text\s+not\s+null/i);
    expect(metadata).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?error_message/i);
    expect(foundation).toContain("error_message text");
  });

  it("adds nullable normalization version metadata without inventing a database default", () => {
    expect(metadata).toContain("add column if not exists normalization_version text");
    expect(metadata).toContain("normalization contract used before calculating source_hash and source_payload");
    expect(metadata).toContain("importer execution supplies this explicitly");
    expect(metadata).not.toMatch(/normalization_version\s+text\s+not\s+null/i);
    expect(metadata).not.toMatch(/normalization_version\s+text\s+default/i);
    expect(metadata).not.toContain("daily-readings-v1");
  });

  it("preserves existing source hash and normalized payload storage", () => {
    expect(foundation).toContain("source_hash text not null");
    expect(foundation).toContain("source_payload jsonb");
    expect(metadata).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?source_hash/i);
    expect(metadata).not.toMatch(/drop\s+column\s+(?:if\s+exists\s+)?source_payload/i);
    expect(metadata).not.toMatch(/alter\s+table\s+public\.content_import_items\s+alter\s+column\s+source_hash/i);
    expect(metadata).not.toMatch(/alter\s+table\s+public\.content_import_items\s+alter\s+column\s+source_payload/i);
  });

  it("does not freeze the future importer error-code vocabulary in database constraints", () => {
    expect(metadata).not.toMatch(/check\s*\([^;]*error_code/i);
    expect(metadata).not.toMatch(/constraint\s+[^;]*error_code/i);
    expect(metadata).not.toMatch(/error_code\s+in\s*\(/i);
  });

  it("leaves existing content_import_items RLS and grants untouched", () => {
    expect(foundation).toContain("alter table public.content_import_items enable row level security");
    expect(foundation).toContain('create policy "super admins manage cms import items"');
    expect(foundation).toContain("on public.content_import_items for all to authenticated");
    expect(foundation).toContain("revoke all on table public.content_import_items from public, anon, authenticated");
    expect(foundation).toContain("grant select, insert, update, delete on public.content_import_items to authenticated");

    expect(metadata).not.toMatch(/create\s+policy|drop\s+policy|alter\s+policy/i);
    expect(metadata).not.toMatch(/grant\s+|revoke\s+/i);
    expect(metadata).not.toMatch(/for\s+select\s+to\s+authenticated\s+using\s*\(\s*true\s*\)/i);
    expect(metadata).not.toMatch(/for\s+select\s+to\s+anon/i);
    expect(metadata).not.toMatch(/church_admin|pastor|secretary|church_staff/i);
  });

  it("does not change member Daily Readings visibility or the canonical RPC", () => {
    expect(visibility).toContain('create policy "authenticated users can read member-visible cms daily readings"');
    expect(visibility).toContain("status in ('published', 'featured') and visibility in ('public', 'member')");
    expect(rpc).toContain("create or replace function public.get_member_daily_reading(p_reading_date date)");
    expect(rpc).toContain("cdr.status in ('published', 'featured')");
    expect(rpc).toContain("cdr.visibility in ('public', 'member')");

    expect(metadata).not.toMatch(/content_daily_readings/i);
    expect(metadata).not.toMatch(/get_member_daily_reading/i);
  });

  it("does not implement importer execution, external integration, or scripture text storage", () => {
    expect(metadata).not.toMatch(/create\s+(?:or\s+replace\s+)?function/i);
    expect(metadata).not.toMatch(/supabase\.co|http|fetch|api[_-]?key|service_role/i);
    expect(metadata).not.toMatch(/insert\s+into\s+public\.content_daily_readings/i);
    expect(metadata).not.toMatch(/scripture_text|first_reading_text|gospel_text|passage_text/i);
  });
});
