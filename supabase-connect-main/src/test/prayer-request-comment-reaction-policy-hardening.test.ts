import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hardeningMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260829170000_harden_prayer_request_comment_reaction_policies.sql"),
  "utf8",
);
const originalMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260829163000_add_prayer_request_comment_reactions.sql"),
  "utf8",
);

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function policyBody(policyName: string) {
  const escapedName = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = hardeningMigration.match(
    new RegExp(`CREATE POLICY "${escapedName}"[\\s\\S]*?(?=\\nCREATE POLICY|\\s*$)`, "i"),
  );
  return normalizeSql(match?.[0] ?? "");
}

const updatePolicy = policyBody("Update own prayer request comment reactions");
const deletePolicy = policyBody("Delete own prayer request comment reactions");

describe("prayer request comment reaction policy hardening", () => {
  it("keeps the original SELECT and INSERT policies out of the hardening migration", () => {
    expect(originalMigration).toContain('CREATE POLICY "View prayer request comment reactions"');
    expect(originalMigration).toContain('CREATE POLICY "Create prayer request comment reactions"');
    expect(hardeningMigration).not.toContain('DROP POLICY IF EXISTS "View prayer request comment reactions"');
    expect(hardeningMigration).not.toContain('DROP POLICY IF EXISTS "Create prayer request comment reactions"');
    expect(hardeningMigration).not.toContain('CREATE POLICY "View prayer request comment reactions"');
    expect(hardeningMigration).not.toContain('CREATE POLICY "Create prayer request comment reactions"');
  });

  it("hardens UPDATE with ownership and current parent create permission in USING and WITH CHECK", () => {
    expect(updatePolicy).toContain("FOR UPDATE");
    expect(updatePolicy).toContain("TO authenticated");
    expect(updatePolicy).toMatch(/USING\s*\(/i);
    expect(updatePolicy).toMatch(/WITH CHECK\s*\(/i);
    expect(updatePolicy.match(/user_id = auth\.uid\(\)/g)).toHaveLength(2);
    expect(updatePolicy.match(/FROM public\.prayer_request_comments prc/g)).toHaveLength(2);
    expect(updatePolicy.match(/prc\.id = prayer_request_comment_reactions\.comment_id/g)).toHaveLength(2);
    expect(updatePolicy.match(/public\.has_related_feature_permission\( 'prayer_request_comments', to_jsonb\(prc\), 'create' \)/g)).toHaveLength(2);
  });

  it("hardens DELETE with ownership and current parent delete permission", () => {
    expect(deletePolicy).toContain("FOR DELETE");
    expect(deletePolicy).toContain("TO authenticated");
    expect(deletePolicy).toMatch(/USING\s*\(/i);
    expect(deletePolicy).not.toMatch(/WITH CHECK/i);
    expect(deletePolicy.match(/user_id = auth\.uid\(\)/g)).toHaveLength(1);
    expect(deletePolicy.match(/FROM public\.prayer_request_comments prc/g)).toHaveLength(1);
    expect(deletePolicy.match(/prc\.id = prayer_request_comment_reactions\.comment_id/g)).toHaveLength(1);
    expect(deletePolicy.match(/public\.has_related_feature_permission\( 'prayer_request_comments', to_jsonb\(prc\), 'delete' \)/g)).toHaveLength(1);
  });

  it("does not attach the generic feature mutation trigger to the reaction table", () => {
    expect(hardeningMigration).not.toContain("enforce_feature_mutation_permission");
    expect(hardeningMigration).not.toMatch(/CREATE\s+TRIGGER/i);
  });
});
