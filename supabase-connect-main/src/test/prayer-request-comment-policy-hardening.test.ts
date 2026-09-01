import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260831110000_harden_prayer_request_comment_policies.sql"),
  "utf8",
);
const sqlTest = readFileSync(
  join(process.cwd(), "supabase/tests/prayer_request_comment_rls_hardening.sql"),
  "utf8",
);

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function policyBody(policyName: string) {
  const escapedName = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = migration.match(
    new RegExp(`CREATE POLICY "${escapedName}"[\\s\\S]*?(?=\\nCREATE POLICY|\\s*$)`, "i"),
  );
  return normalizeSql(match?.[0] ?? "");
}

const selectPolicy = policyBody("Parent-visible prayer request comments are readable");
const insertPolicy = policyBody("Parent-visible prayer request comments can be created");

describe("prayer request comment policy hardening", () => {
  it("replaces only the broad prayer_request_comments SELECT and INSERT policies", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Church members can create prayer request comments"');
    expect(migration).toContain('DROP POLICY IF EXISTS "Church members can view prayer request comments"');
    expect(migration).toContain('DROP POLICY IF EXISTS "comments same church"');
    expect(migration).toContain('ALTER TABLE public.prayer_request_comments ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toMatch(/FOR UPDATE/i);
    expect(migration).not.toMatch(/FOR DELETE/i);
    expect(migration).not.toMatch(/GRANT\s+/i);
    expect(migration).not.toMatch(/SECURITY DEFINER/i);
  });

  it("requires parent prayer existence and matching church for reads and inserts", () => {
    for (const policy of [selectPolicy, insertPolicy]) {
      expect(policy).toContain("FROM public.prayer_requests pr");
      expect(policy).toContain("pr.id = prayer_request_comments.prayer_request_id");
      expect(policy).toContain("pr.church_id = prayer_request_comments.church_id");
    }
  });

  it("preserves the exact parent prayer visibility contract", () => {
    for (const policy of [selectPolicy, insertPolicy]) {
      expect(policy).toContain("owner_member.id = pr.member_id");
      expect(policy).toContain("owner_member.user_id = auth.uid()");
      expect(policy).toContain("pr.status = 'approved'");
      expect(policy).toContain("pr.privacy IN ('public_to_church', 'anonymous_public')");
      expect(policy).toContain("public.is_church_member(auth.uid(), pr.church_id)");
      expect(policy).toContain("public.can_review_pastoral_requests(pr.church_id)");
    }
  });

  it("prevents insert identity spoofing while preserving member and staff comment identities", () => {
    expect(insertPolicy).toContain("prayer_request_comments.member_id IS NOT NULL");
    expect(insertPolicy).toContain("commenter_member.id = prayer_request_comments.member_id");
    expect(insertPolicy).toContain("commenter_member.user_id = auth.uid()");
    expect(insertPolicy).toContain("commenter_member.church_id = prayer_request_comments.church_id");
    expect(insertPolicy).toContain("prayer_request_comments.member_id IS NULL");
    expect(insertPolicy).toContain("commenter_role.user_id = auth.uid()");
    expect(insertPolicy).toContain("commenter_role.church_id = prayer_request_comments.church_id");
  });

  it("documents executable SQL coverage for allow and deny cases", () => {
    expect(sqlTest).toContain("owner can read comments on own private prayer");
    expect(sqlTest).toContain("owner can read comments on own pending prayer");
    expect(sqlTest).toContain("same-church member can read approved public prayer comments");
    expect(sqlTest).toContain("authorized reviewer can read private parent comments");
    expect(sqlTest).toContain("legitimate member can insert comment on visible approved shared prayer");
    expect(sqlTest).toContain("owner can insert comment on own visible prayer");
    expect(sqlTest).toContain("unrelated same-church member cannot read private parent comments");
    expect(sqlTest).toContain("unrelated same-church member cannot read pending parent comments");
    expect(sqlTest).toContain("unrelated same-church member cannot read rejected parent comments");
    expect(sqlTest).toContain("cross-church member cannot read comments");
    expect(sqlTest).toContain("comment church_id cannot differ from parent church_id");
    expect(sqlTest).toContain("caller cannot insert comment against hidden pending parent prayer");
    expect(sqlTest).toContain("caller cannot spoof another member identity");
    expect(sqlTest).toContain("rollback;");
  });
});
