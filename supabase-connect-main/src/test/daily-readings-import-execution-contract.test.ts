import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260907170000_apply_daily_readings_import.sql"),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

describe("Daily Readings transactional import execution contract", () => {
  it("creates a hardened trusted execution RPC and grants only authenticated invocation", () => {
    expect(normalized).toContain("create or replace function public.apply_daily_readings_import");
    expect(normalized).toContain("returns jsonb");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = public, pg_temp");
    expect(normalized).toContain("if v_actor is null then");
    expect(normalized).toContain("raise exception 'authentication required' using errcode = '42501'");
    expect(normalized).toContain("public.is_platform_super_admin(v_actor) or public.is_super_admin(v_actor)");
    expect(normalized).toContain("raise exception 'super admin access required' using errcode = '42501'");
    expect(normalized).toContain("revoke all on function public.apply_daily_readings_import(uuid, jsonb) from public");
    expect(normalized).toContain("revoke all on function public.apply_daily_readings_import(uuid, jsonb) from anon");
    expect(normalized).toContain("revoke all on function public.apply_daily_readings_import(uuid, jsonb) from authenticated");
    expect(normalized).toContain("grant execute on function public.apply_daily_readings_import(uuid, jsonb) to authenticated");
  });

  it("requires normalized prepared source records and a daily_reading import batch", () => {
    expect(normalized).toContain("cib.content_type = 'daily_reading'");
    expect(normalized).toContain("jsonb_typeof(_sources) is distinct from 'array'");
    expect(normalized).toContain("v_payload := v_source -> 'normalized_payload'");
    expect(normalized).toContain("v_source_hash := nullif(btrim(v_source ->> 'source_hash'), '')");
    expect(normalized).toContain("v_normalization_version := nullif(btrim(v_source ->> 'normalization_version'), '')");
    expect(normalized).toContain("v_source_hash !~ '^[a-f0-9]{64}$'");
    expect(normalized).toContain("where cl.code = v_language_code");
  });

  it("re-derives safe decisions under locks before writing", () => {
    expect(normalized).toContain("for update of cdr");
    expect(normalized).toContain("for update");
    expect(normalized).toContain("v_current_payload <> v_last_payload");
    expect(normalized).toContain("conflict_manual_drift");
    expect(normalized).toContain("skip_unchanged");
    expect(normalized).toContain("v_existing_source.status in ('published', 'featured')");
    expect(normalized).toContain("conflict_published_source_changed");
    expect(normalized).toContain("cdr.source_key is distinct from v_source_key");
    expect(normalized).toContain("cdr.source_record_id is distinct from v_source_record_id");
    expect(normalized).toContain("conflict_date_language_source_collision");
    expect(normalized).toContain("conflict_manual_content_collision");
  });

  it("creates new CMS readings as draft/member and never publishes", () => {
    expect(normalized).toContain("insert into public.content_daily_readings");
    expect(normalized).toContain("'draft'");
    expect(normalized).toContain("'member'");
    expect(normalized).not.toMatch(/status\s*=\s*'published'|status\s*=\s*'featured'/);
    expect(normalized).not.toMatch(/values\s*\([^;]*'published'/);
    expect(normalized).not.toMatch(/values\s*\([^;]*'featured'/);
  });

  it("updates only source-controlled fields and provenance metadata", () => {
    const updateStart = normalized.indexOf("update public.content_daily_readings set", normalized.indexOf("elsif v_decision = 'update_draft_from_source'"));
    const updateEnd = normalized.indexOf("where id = v_existing_source.id", updateStart);
    const updateBlock = normalized.slice(updateStart, updateEnd);

    expect(updateBlock).toContain("first_reading_reference = btrim");
    expect(updateBlock).toContain("responsorial_psalm_reference = btrim");
    expect(updateBlock).toContain("gospel_reference = btrim");
    expect(updateBlock).toContain("source_attribution = btrim");
    expect(updateBlock).toContain("last_imported_source_hash = v_source_hash");
    expect(updateBlock).toContain("last_import_item_id = v_item_id");
    expect(updateBlock).not.toMatch(/\breflection\s*=/);
    expect(updateBlock).not.toMatch(/\bprayer\s*=/);
    expect(updateBlock).not.toMatch(/\bmeditation_questions\s*=/);
    expect(updateBlock).not.toMatch(/\bdaily_challenge\s*=/);
    expect(updateBlock).not.toMatch(/\beditorial_notes\s*=/);
    expect(updateBlock).not.toMatch(/\bstatus\s*=/);
    expect(updateBlock).not.toMatch(/\bvisibility\s*=/);
  });

  it("keeps CMS rows and import-item provenance linked transactionally", () => {
    expect(normalized).toContain("insert into public.content_import_items");
    expect(normalized).toContain("source_payload");
    expect(normalized).toContain("error_code");
    expect(normalized).toContain("normalization_version");
    expect(normalized).toContain("last_import_item_id");
    expect(normalized).toContain("update public.content_import_items set target_record_id = v_target_id");
    expect(normalized).toContain("target_table");
    expect(normalized).toContain("'content_daily_readings'");
  });

  it("does not introduce frontend service-role use, external sources, or scripture text ingestion", () => {
    expect(normalized).not.toMatch(/service_role|service-role|vite_|supabase\.co|http\(|https\(|fetch|net\./);
    expect(normalized).not.toMatch(/scripture_text|first_reading_text|gospel_text|passage_text/);
    expect(normalized).not.toMatch(/alter\s+table\s+public\.content_daily_readings\s+disable\s+row\s+level\s+security/i);
    expect(normalized).not.toMatch(/create\s+policy|drop\s+policy|alter\s+policy/i);
  });
});
