import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packagePath = join(process.cwd(), "supabase/seed/saints/canonical/2026-08-31.json");
const payload = JSON.parse(readFileSync(packagePath, "utf8")) as CanonicalSaintPackage;

type CanonicalSaintPackage = {
  package_date: string;
  production_import_status: string;
  production_import_blockers: string[];
  editorial_approval: {
    status: string;
    source_url: string;
    editorial_author: string;
    editorial_reviewer: string;
    editorial_approval_date: string;
    content_license_basis: string;
  };
  saints: CanonicalSaint[];
};

type CanonicalSaint = {
  slug: string;
  name: string;
  feast_month: number;
  feast_day: number;
  biography_short: string;
  biography_long: string;
  reflection: string;
  prayer: string;
  liturgical_rank: string | null;
  is_featured: boolean;
  tags: string[];
  translations?: unknown[];
  provenance: Array<{
    translation_language_code?: string | null;
    source_organization: string;
    source_publication: string | null;
    source_url: string | null;
    source_checked_date: string;
    source_role: string;
    editorial_author: string;
    editorial_reviewer: string;
    editorial_approval_date: string;
    content_license_basis: string;
    factual_notes: string;
  }>;
};

const allowedRanks = new Set(["Solemnity", "Feast", "Memorial", "Optional Memorial"]);
const requiredUrl = "https://www.vaticannews.va/en/saints/08/31.html";
const placeholderValues = new Set([
  "PENDING_NOT_VERIFIED",
  "PENDING_EDITORIAL_AUTHOR",
  "PENDING_EDITORIAL_REVIEWER",
  "1900-01-01",
]);

function approvalValueIsPlaceholder(value: string) {
  return value.startsWith("PENDING_") || placeholderValues.has(value);
}

function isProductionApproved(value: CanonicalSaintPackage) {
  const approvalValues = [
    value.editorial_approval.editorial_author,
    value.editorial_approval.editorial_reviewer,
    value.editorial_approval.editorial_approval_date,
    value.editorial_approval.content_license_basis,
    ...value.saints.flatMap((saint) =>
      saint.provenance.flatMap((provenance) => [
        provenance.editorial_author,
        provenance.editorial_reviewer,
        provenance.editorial_approval_date,
        provenance.content_license_basis,
      ]),
    ),
  ];

  return (
    value.production_import_status === "approved_for_production_import" &&
    value.editorial_approval.status === "APPROVED" &&
    approvalValues.every((approvalValue) => !approvalValueIsPlaceholder(approvalValue))
  );
}

describe("August 31 canonical saints package", () => {
  it("contains exactly three unique August 31 saint records", () => {
    expect(payload.package_date).toBe("2026-08-31");
    expect(payload.saints).toHaveLength(3);
    expect(new Set(payload.saints.map((saint) => saint.slug)).size).toBe(3);

    for (const saint of payload.saints) {
      expect(saint.feast_month).toBe(8);
      expect(saint.feast_day).toBe(31);
    }
  });

  it("features only St. Raymond Nonnato", () => {
    const featured = payload.saints.filter((saint) => saint.is_featured);
    expect(featured).toHaveLength(1);
    expect(featured[0]?.slug).toBe("st-raymond-nonnato");
  });

  it("uses valid optional ranks, tags, and complete editorial content", () => {
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/vocation wasmarked|afterhis death|Archbishopof Milan/);
    expect(serialized).not.toMatch(/[a-z](?:of|and|the|was|his|her|their|with|from|for)[A-Z]/);

    for (const saint of payload.saints) {
      if (saint.liturgical_rank !== null) {
        expect(allowedRanks.has(saint.liturgical_rank)).toBe(true);
      }

      expect(saint.biography_short.trim().length).toBeGreaterThan(40);
      expect(saint.biography_long.trim().length).toBeGreaterThan(120);
      expect(saint.reflection.trim().length).toBeGreaterThan(40);
      expect(saint.prayer.trim().length).toBeGreaterThan(40);

      for (const tag of saint.tags) {
        expect(tag).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      }
    }
  });

  it("omits incomplete translations", () => {
    for (const saint of payload.saints) {
      expect(saint.translations ?? []).toHaveLength(0);
    }
  });

  it("preserves Vatican factual provenance without duplicate identities", () => {
    const identities = new Set<string>();

    for (const saint of payload.saints) {
      expect(saint.provenance.length).toBeGreaterThanOrEqual(1);

      for (const provenance of saint.provenance) {
        expect(provenance.source_organization).toBe("Vatican News");
        expect(provenance.source_publication).toBe("Saint of the Day");
        expect(provenance.source_url).toBe(requiredUrl);
        expect(provenance.source_checked_date).toBe("2026-08-31");
        expect(provenance.source_role).toBe("factual_reference");
        expect(provenance.factual_notes).toContain("Verifies the August 31 listing");

        const identity = [
          saint.slug,
          provenance.translation_language_code ?? "",
          provenance.source_role,
          provenance.source_organization,
          provenance.source_publication ?? "",
          provenance.source_url ?? "",
        ].join("|");

        expect(identities.has(identity)).toBe(false);
        identities.add(identity);
      }
    }
  });

  it("is explicitly blocked from production import until approval placeholders are replaced", () => {
    expect(payload.production_import_status).toBe("blocked_pending_editorial_approval");
    expect(payload.production_import_blockers).toContain("editorial_author is a placeholder");
    expect(payload.production_import_blockers).toContain("editorial_reviewer is a placeholder");
    expect(payload.production_import_blockers).toContain("editorial_approval_date uses the schema-compatible sentinel 1900-01-01");
    expect(payload.production_import_blockers).toContain("content_license_basis is pending and not verified");
    expect(payload.editorial_approval.status).toBe("PENDING_NOT_VERIFIED");

    const approvalValues = [
      payload.editorial_approval.editorial_author,
      payload.editorial_approval.editorial_reviewer,
      payload.editorial_approval.editorial_approval_date,
      payload.editorial_approval.content_license_basis,
      ...payload.saints.flatMap((saint) =>
        saint.provenance.flatMap((provenance) => [
          provenance.editorial_author,
          provenance.editorial_reviewer,
          provenance.editorial_approval_date,
          provenance.content_license_basis,
        ]),
      ),
    ];

    expect(payload.editorial_approval.editorial_author.startsWith("PENDING_")).toBe(true);
    expect(payload.editorial_approval.editorial_reviewer.startsWith("PENDING_")).toBe(true);
    expect(payload.editorial_approval.editorial_approval_date).toBe("1900-01-01");
    expect(payload.editorial_approval.content_license_basis).toBe("PENDING_NOT_VERIFIED");
    expect(approvalValues.some(approvalValueIsPlaceholder)).toBe(true);
    expect(isProductionApproved(payload)).toBe(false);
  });
});
