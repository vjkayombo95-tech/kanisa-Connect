import { describe, expect, it } from "vitest";

import {
  buildCmsHealthIssues,
  buildPrayerRestoreDraft,
  classifyPrayerProvenance,
  filterMemberPrayers,
  importRowToDraft,
  isPublishedForMembers,
  validatePrayerContent,
  validatePrayerImportRows,
  validatePrayerPublicationSafety,
  type CatholicPrayerContent,
  type ContentCategory,
  type ContentCollection,
  type ContentLanguage,
  type ContentTag,
} from "@/lib/catholic-cms";

const category: ContentCategory = { id: "cat-healing", name: "Healing", slug: "healing", description: null, icon: null, color: null, parent_id: null, sort_order: 1, is_active: true };
const language: ContentLanguage = { id: "lang-en", code: "en", name: "English", native_name: "English", is_default: true };
const tag: ContentTag = { id: "tag-mercy", name: "Mercy", slug: "mercy", description: null, color: null };
const collection: ContentCollection = { id: "col-morning", title: "Morning Prayers", slug: "morning-prayers", description: null, cover_image: null, featured: true, status: "published" };

function prayer(overrides: Partial<CatholicPrayerContent> = {}): CatholicPrayerContent {
  return {
    id: "prayer-1",
    title: "Prayer for Healing",
    slug: "prayer-for-healing",
    summary: "A healing prayer.",
    body: "Lord, bring healing and peace.",
    category_id: category.id,
    language_id: language.id,
    status: "published",
    featured: false,
    visibility: "member",
    author: "Kanisa",
    source: "CMS",
    liturgical_season: "Ordinary Time",
    scripture_reference: "James 5:14",
    estimated_read_time: 1,
    cover_image: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-04T00:00:00.000Z",
    updated_at: "2026-07-04T00:00:00.000Z",
    category,
    language,
    tags: [tag],
    collections: [collection],
    ...overrides,
  };
}

const reference = {
  categories: [category],
  languages: [language],
  tags: [tag],
  collections: [collection],
};

describe("Catholic CMS prayer engine", () => {
  it("allows member access only for published or featured member-visible prayers", () => {
    expect(isPublishedForMembers(prayer())).toBe(true);
    expect(isPublishedForMembers(prayer({ status: "draft" }))).toBe(false);
    expect(isPublishedForMembers(prayer({ status: "review" }))).toBe(false);
    expect(isPublishedForMembers(prayer({ status: "archived" }))).toBe(false);
    expect(isPublishedForMembers(prayer({ visibility: "admin" }))).toBe(false);
  });

  it("excludes drafts and supports category, tag, collection, and scripture search filters", () => {
    const visible = prayer();
    const draft = prayer({ id: "draft", slug: "draft", status: "draft" });

    expect(filterMemberPrayers([visible, draft], { categoryId: category.id })).toHaveLength(1);
    expect(filterMemberPrayers([visible], { tag: "mercy" })).toHaveLength(1);
    expect(filterMemberPrayers([visible], { collectionId: collection.id })).toHaveLength(1);
    expect(filterMemberPrayers([visible], { tag: tag.slug })).toHaveLength(1);
    expect(filterMemberPrayers([visible], { search: "James 5" })).toHaveLength(1);
    expect(filterMemberPrayers([visible], { search: "unknown phrase" })).toHaveLength(0);
  });

  it("returns only featured prayers when member callers filter featured results", () => {
    const featured = prayer({ id: "featured", slug: "featured", featured: true });
    const regular = prayer({ id: "regular", slug: "regular", featured: false });

    expect(filterMemberPrayers([featured, regular]).filter((item) => item.featured)).toEqual([featured]);
  });

  it("validates import rows for required fields, duplicates, invalid lifecycle, and missing references", () => {
    const validation = validatePrayerImportRows(
      [
        { rowNumber: 2, title: "Prayer for Healing", prayerBody: "Body", category: "Healing", language: "English", status: "published", visibility: "member", tags: "Mercy", collection: "Morning Prayers" },
        { rowNumber: 3, title: "Prayer for Healing", prayerBody: "", category: "Unknown", language: "Klingon", status: "bad", visibility: "hidden", slug: "prayer-for-healing" },
      ],
      reference,
      [prayer()],
    );

    expect(validation.hasErrors).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Prayer Body" && issue.severity === "error")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Slug" && issue.severity === "warning")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Category" && issue.severity === "error")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Language" && issue.severity === "error")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Source" && issue.severity === "warning")).toBe(true);
  });

  it("flags missing prayer body, duplicate slug, unknown source, and optional metadata warnings", () => {
    const issues = validatePrayerContent(
      prayer({ body: "", slug: "duplicate", source: null, author: null, summary: null, category_id: null, tags: [], collections: [] }),
      reference,
      [prayer({ id: "other", slug: "duplicate" })],
    );

    expect(issues.some((issue) => issue.field === "Prayer Body" && issue.severity === "error")).toBe(true);
    expect(issues.some((issue) => issue.field === "Slug" && issue.severity === "error")).toBe(true);
    expect(issues.some((issue) => issue.field === "Provenance" && issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.field === "Collection" && issue.severity === "warning")).toBe(true);
  });

  it("classifies prayer provenance without claiming ownership for unknown content", () => {
    expect(classifyPrayerProvenance(prayer({ source: "Traditional / Public Domain", author: null }))).toBe("traditional_public_domain");
    expect(classifyPrayerProvenance(prayer({ source: "Original Kanisa Connect Content", author: "Kanisa" }))).toBe("original_kanisa_connect_content");
    expect(classifyPrayerProvenance(prayer({ source: null, author: null }))).toBe("unknown_source");
  });

  it("blocks bulk publication for invalid or restricted prayers but allows warning-only records", () => {
    const valid = prayer({ source: null, author: null });
    const blocked = prayer({ id: "blocked", slug: "blocked", visibility: "admin" });
    const invalid = prayer({ id: "invalid", slug: "invalid", body: "" });

    const warningOnly = validatePrayerPublicationSafety([valid], reference, [valid]);
    const unsafe = validatePrayerPublicationSafety([valid, blocked, invalid], reference, [valid, blocked, invalid]);

    expect(warningOnly.canPublish).toBe(true);
    expect(warningOnly.warnings.some((issue) => issue.field === "Provenance")).toBe(true);
    expect(unsafe.canPublish).toBe(false);
    expect(unsafe.blockedRecords).toHaveLength(2);
  });

  it("maps valid import rows into editor drafts with resolved category, language, and collection", () => {
    const draft = importRowToDraft(
      { rowNumber: 2, title: "Morning Mercy", prayerBody: "Lord have mercy.", category: "Healing", language: "English", status: "featured", visibility: "public", collection: "Morning Prayers", featured: "yes" },
      reference,
    );

    expect(draft.slug).toBe("morning-mercy");
    expect(draft.category_id).toBe(category.id);
    expect(draft.language_id).toBe(language.id);
    expect(draft.collection_ids).toEqual([collection.id]);
    expect(draft.featured).toBe(true);
  });

  it("builds restore drafts without deleting current taxonomy relationships", () => {
    const current = prayer();
    const restored = buildPrayerRestoreDraft(current, { title: "Old Title", body: "Old body", status: "review" });

    expect(restored.id).toBe(current.id);
    expect(restored.title).toBe("Old Title");
    expect(restored.status).toBe("review");
    expect(restored.tag_names).toBe("Mercy");
    expect(restored.collection_ids).toEqual([collection.id]);
  });

  it("reports content health for missing taxonomy, review content, empty collections, and broken relationships", () => {
    const issues = buildCmsHealthIssues(
      [prayer({ category_id: null, language_id: null, tags: [], status: "review" })],
      [{ ...collection, id: "empty", title: "Empty Collection" }],
      [{ id: "rel-1", source_type: "prayer", source_id: "", target_type: "saint", target_id: "", relationship_type: "related_to", created_at: "2026-07-04T00:00:00.000Z" }],
    );

    expect(issues.some((issue) => issue.message === "Missing category.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Missing language.")).toBe(true);
    expect(issues.some((issue) => issue.message === "No tags assigned.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Draft content awaits review.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Collection has no prayers.")).toBe(true);
    expect(issues.some((issue) => issue.message === "Broken relationship target.")).toBe(true);
  });
});
