import { describe, expect, it } from "vitest";

import {
  PRAYER_WORKBOOK_HEADERS,
  PRODUCTION_PROJECT_REF,
  assertApprovedStagingRef,
  assertStagingImportConfirmation,
  buildPrayerImportPlan,
  matchPrayerRecord,
  validateWorkbookHeaders,
  type PrayerCatalogRecord,
  type PrayerWorkbookRow,
} from "../../scripts/prayer-library/prayer-import-core";

const category = { id: "cat-1", name: "Sala za Kila Siku", slug: "daily-prayers" };
const language = { id: "lang-sw", code: "sw", name: "Kiswahili" };
const parent: PrayerCatalogRecord = {
  id: "parent-1", prayer_code: "parent-code", slug: "parent", title: "Parent", parent_prayer_id: null,
  prayer_type: "collection", category_id: category.id, language_id: language.id, sort_order: 1,
  summary: null, body: null, status: "draft", visibility: "member", featured: false,
  recommended_time: null, scripture_reference: null, liturgical_season: null, audio_url: null,
  author: null, source: null, metadata: { seeded_title_only: true }, is_global: true, church_id: null,
  source_title: null, source_type: null, source_organization: null, source_reference: null, source_url: null, source_notes: null,
  copyright_holder: null, copyright_notice: null, license_type: null, license_reference: null, content_edition: null,
  content_version_label: null, ecclesial_approval_status: "pending", ecclesial_approval_authority: null,
  ecclesial_approval_reference: null, reviewed_by: null, reviewed_at: null, translation_group_id: "group-parent", translation_key: "PARENT_CODE",
};
const prayer: PrayerCatalogRecord = {
  ...parent, id: "prayer-1", prayer_code: "sala-test", slug: "sala-test", title: "Sala Test",
  parent_prayer_id: parent.id, prayer_type: "section", sort_order: 2, translation_group_id: "group-prayer", translation_key: "SALA_TEST",
};
const reference = { categories: [category], languages: [language] };

function row(overrides: Partial<PrayerWorkbookRow> = {}): PrayerWorkbookRow {
  return {
    __rowNumber: 2,
    "Prayer Code": prayer.prayer_code!, Slug: prayer.slug, Title: prayer.title,
    "Parent Prayer Code": parent.prayer_code!, "Parent Title": parent.title, "Prayer Type": prayer.prayer_type,
    Category: category.name, "Category Slug": category.slug, "Sort Order": prayer.sort_order,
    Language: "sw", "Translation Key": prayer.translation_key!, "Translation Group ID": prayer.translation_group_id, Summary: "", "Prayer Body": "", Status: "draft", Visibility: "member",
    Featured: "false", "Recommended Time": "", "Scripture Reference": "", "Liturgical Season": "",
    "Audio URL": "", Author: "", Source: "", "Content Edition": "", "Content Version": "",
    "Source Type": "", "Source Title": "", "Source Organization": "", "Source Reference": "", "Source URL": "", "Source Notes": "",
    "Copyright Holder": "", "Copyright Notice": "", "License Type": "", "License Reference": "", "Reviewed By": "",
    "Review Date": "", "Ecclesial Approval Status": "pending", "Ecclesial Approval Authority": "", "Ecclesial Approval Reference": "", "Import Notes": "", ...overrides,
  };
}

function plan(rows: PrayerWorkbookRow[], options = {}) {
  return buildPrayerImportPlan(rows, [parent, prayer], reference, options);
}

describe("controlled Prayer Library import", () => {
  it("matches by prayer_code before slug", () => {
    expect(matchPrayerRecord(row({ Slug: "wrong-slug" }), [parent, prayer])?.id).toBe(prayer.id);
  });

  it("supports slug fallback only when prayer_code is absent", () => {
    expect(matchPrayerRecord(row({ "Prayer Code": "" }), [parent, prayer])?.id).toBe(prayer.id);
  });

  it("never uses title as the sole identity", () => {
    expect(plan([row({ "Prayer Code": "", Slug: "", Title: prayer.title })]).matchedRecords).toBe(0);
  });

  it("rejects duplicate prayer codes", () => {
    const result = plan([row(), row({ __rowNumber: 3, Slug: "another-slug" })]);
    expect(result.errors.some((error) => error.code === "duplicate_prayer_code")).toBe(true);
  });

  it("rejects duplicate slugs", () => {
    const result = plan([row(), row({ __rowNumber: 3, "Prayer Code": parent.prayer_code!, "Parent Prayer Code": "", "Prayer Type": parent.prayer_type, "Sort Order": 1 })]);
    expect(result.errors.some((error) => error.code === "duplicate_slug")).toBe(true);
  });

  it("does not erase existing non-empty fields with blank cells", () => {
    const existing = { ...prayer, summary: "Existing", body: "Existing body", source: "Existing source" };
    const result = buildPrayerImportPlan([row()], [parent, existing], reference);
    expect(result.changes).toHaveLength(0);
  });

  it("updates a body only when a non-empty body is supplied", () => {
    const result = plan([row({ "Prayer Body": "Approved supplied text" })]);
    expect(result.changes[0].next.body).toBe("Approved supplied text");
    expect(result.bodiesThatWouldUpdate).toBe(1);
  });

  it("creates no version estimate for unchanged rows", () => {
    expect(plan([row()]).versionRecordsThatWouldBeCreated).toBe(0);
  });

  it("estimates one version for each modified row", () => {
    expect(plan([row({ Summary: "New summary" })]).versionRecordsThatWouldBeCreated).toBe(1);
  });

  it("rejects unknown prayer codes even when the slug exists", () => {
    const result = plan([row({ "Prayer Code": "unknown-code" })]);
    expect(result.errors.some((error) => error.code === "unknown_prayer_code")).toBe(true);
  });

  it("preserves global ownership and church_id", () => {
    const result = plan([row({ Summary: "Changed" })]);
    expect(result.changes[0].next.is_global).toBe(true);
    expect(result.changes[0].next.church_id).toBeNull();
  });

  it("rejects system ownership headers", () => {
    const result = validateWorkbookHeaders([...PRAYER_WORKBOOK_HEADERS, "church_id", "Created By"]);
    expect(result.forbidden).toEqual(["church_id", "Created By"]);
  });

  it("rejects invalid parent relationships", () => {
    expect(plan([row({ "Parent Prayer Code": "other-parent" })]).parentChildValidationErrors).toBeGreaterThan(0);
  });

  it("rejects invalid and non-draft status for the first staging import", () => {
    expect(plan([row({ Status: "invalid" })]).errors.some((error) => error.code === "invalid_status")).toBe(true);
    expect(plan([row({ Status: "review" })]).errors.some((error) => error.code === "first_import_draft_required")).toBe(true);
  });

  it("rejects publication without body", () => {
    const result = plan([row({ Status: "published", Source: "Missal", "Reviewed By": "Reviewer", "Review Date": "2026-07-18", "Ecclesial Approval Status": "approved" })], { forceDraft: false, allowReviewedPublish: true });
    expect(result.errors.some((error) => error.code === "publish_body_required")).toBe(true);
  });

  it("rejects publication without source", () => {
    const result = plan([row({ Status: "published", "Prayer Body": "Reviewed text", "Reviewed By": "Reviewer", "Review Date": "2026-07-18", "Ecclesial Approval Status": "approved" })], { forceDraft: false, allowReviewedPublish: true });
    expect(result.errors.some((error) => error.code === "publish_source_type_required" || error.code === "publish_traceable_source_required")).toBe(true);
  });

  it("rejects publication without ecclesial approval", () => {
    const result = plan([row({ Status: "published", "Prayer Body": "Reviewed text", Source: "Missal", "Reviewed By": "Reviewer", "Review Date": "2026-07-18" })], { forceDraft: false, allowReviewedPublish: true });
    expect(result.errors.some((error) => error.code === "publish_approval_required")).toBe(true);
  });

  it("imports valid explicit provenance fields", () => {
    const result = plan([row({ "Source Type": "roman_missal", "Source Title": "Roman Missal", "Content Edition": "Third Edition", "License Type": "licensed", "License Reference": "LIC-1" })]);
    expect(result.errors).toHaveLength(0);
    expect(result.changes[0].next.source_type).toBe("roman_missal");
    expect(result.changes[0].next.source_title).toBe("Roman Missal");
  });

  it("blank provenance cells do not erase existing values", () => {
    const existing = { ...prayer, source_title: "Existing source", license_type: "licensed" };
    const result = buildPrayerImportPlan([row()], [parent, existing], reference);
    expect(result.changes).toHaveLength(0);
    expect(existing.source_title).toBe("Existing source");
  });

  it("rejects invalid source and license types", () => {
    expect(plan([row({ "Source Type": "website" })]).errors.some((error) => error.code === "invalid_source_type")).toBe(true);
    expect(plan([row({ "License Type": "free" })]).errors.some((error) => error.code === "invalid_license_type")).toBe(true);
  });

  it("requires evidence for approved content", () => {
    const result = plan([row({ "Ecclesial Approval Status": "approved" })]);
    expect(result.errors.some((error) => error.code === "approval_evidence_required")).toBe(true);
  });

  it("blocks unknown, untraceable public-domain, and unlicensed restricted publication", () => {
    const base = { Status: "published", "Prayer Body": "Reviewed text", "Source Type": "other", "Source Title": "Traceable title", "Reviewed By": "Reviewer", "Review Date": "2026-07-18", "Ecclesial Approval Status": "approved", "Ecclesial Approval Authority": "Ordinary" } as Partial<PrayerWorkbookRow>;
    expect(plan([row({ ...base, "License Type": "unknown" })], { forceDraft: false, allowReviewedPublish: true }).errors.some((error) => error.code === "publish_license_required")).toBe(true);
    expect(plan([row({ ...base, "License Type": "public_domain", "Source Reference": "", "Source Notes": "" })], { forceDraft: false, allowReviewedPublish: true }).errors.some((error) => error.code === "public_domain_basis_required")).toBe(true);
    expect(plan([row({ ...base, "License Type": "copyright_restricted", "License Reference": "" })], { forceDraft: false, allowReviewedPublish: true }).errors.some((error) => error.code === "copyright_permission_required")).toBe(true);
  });

  it("keeps translation identity immutable", () => {
    expect(plan([row({ "Translation Key": "OTHER" })]).errors.some((error) => error.code === "translation_key_immutable")).toBe(true);
    expect(plan([row({ "Translation Group ID": "other-group" })]).errors.some((error) => error.code === "translation_group_immutable")).toBe(true);
  });

  it("is a pure dry-run planner and does not mutate catalog rows", () => {
    const before = JSON.stringify(prayer);
    plan([row({ Summary: "Would change" })]);
    expect(JSON.stringify(prayer)).toBe(before);
  });

  it("requires explicit staging confirmation", () => {
    expect(() => assertStagingImportConfirmation([])).toThrow(/confirm-staging-import/);
    expect(() => assertStagingImportConfirmation(["--confirm-staging-import"])).not.toThrow();
  });

  it("rejects the production project reference", () => {
    expect(() => assertApprovedStagingRef(PRODUCTION_PROJECT_REF)).toThrow(/Production/);
  });
});
