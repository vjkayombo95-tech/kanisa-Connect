import type { CatholicPrayerContent, CatholicPrayerRelationship, ContentCategory, ContentCollection, ContentLanguage, ContentTag, PrayerEditorDraft } from "@/lib/super-admin/prayer-library-service";

export const VALID_CONTENT_STATUSES = ["draft", "review", "published", "featured", "archived"] as const;
export const VALID_VISIBILITIES = ["public", "member", "pastoral", "admin"] as const;

export type CmsImportRow = {
  rowNumber: number;
  title?: string;
  slug?: string;
  summary?: string;
  prayerBody?: string;
  category?: string;
  tags?: string;
  language?: string;
  status?: string;
  visibility?: string;
  featured?: string | boolean;
  author?: string;
  source?: string;
  liturgicalSeason?: string;
  scriptureReference?: string;
  collection?: string;
};

export type CmsImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
  severity: "error" | "warning" | "information";
};

export type CmsImportValidation = {
  validRows: CmsImportRow[];
  issues: CmsImportIssue[];
  hasErrors: boolean;
};

export type CmsHealthIssue = {
  id: string;
  title: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export type PrayerContentIssue = {
  field: string;
  message: string;
  severity: "error" | "warning" | "information";
};

export type PrayerPublicationSafetyRecord = {
  prayer: CatholicPrayerContent;
  issues: PrayerContentIssue[];
  errors: PrayerContentIssue[];
  warnings: PrayerContentIssue[];
};

export type PrayerPublicationSafetyResult = {
  selectedRecords: number;
  validRecords: PrayerPublicationSafetyRecord[];
  blockedRecords: PrayerPublicationSafetyRecord[];
  warnings: PrayerContentIssue[];
  canPublish: boolean;
};

export type CmsReferenceLookup = {
  categories: ContentCategory[];
  languages: ContentLanguage[];
  tags: ContentTag[];
  collections: ContentCollection[];
};

function normalize(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function cmsSlugify(value: string) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function isPublishedForMembers(prayer: Pick<CatholicPrayerContent, "status" | "visibility">) {
  return ["published", "featured"].includes(prayer.status) && ["public", "member"].includes(prayer.visibility);
}

export function classifyPrayerProvenance(prayer: Pick<CatholicPrayerContent, "author" | "source">) {
  const source = normalize(prayer.source).toLowerCase();
  const author = normalize(prayer.author).toLowerCase();

  if (!source && !author) return "unknown_source";
  if (source.includes("public domain") || source.includes("traditional")) return "traditional_public_domain";
  if (source.includes("kanisa") || author.includes("kanisa")) return "original_kanisa_connect_content";
  if (source.includes("licensed") || source.includes("permission")) return "licensed_permission_based_content";
  if (author) return "attributed_author";
  return "unknown_source";
}

export function prayerMatchesCmsSearch(prayer: CatholicPrayerContent, query: string) {
  const term = normalize(query).toLowerCase();
  if (!term) return true;

  return [
    prayer.title,
    prayer.summary,
    prayer.body,
    prayer.author,
    prayer.source,
    prayer.scripture_reference,
    prayer.liturgical_season,
    prayer.category?.name,
    prayer.language?.name,
    prayer.language?.code,
    ...(prayer.tags ?? []).map((tag) => tag.name),
    ...(prayer.collections ?? []).map((collection) => collection.title),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function filterMemberPrayers(
  prayers: CatholicPrayerContent[],
  filters: { search?: string; categoryId?: string; collectionId?: string; season?: string; tag?: string } = {},
) {
  return prayers.filter((prayer) => {
    if (!isPublishedForMembers(prayer)) return false;
    if (filters.categoryId && filters.categoryId !== "all" && prayer.category_id !== filters.categoryId) return false;
    if (filters.collectionId && filters.collectionId !== "all" && !(prayer.collections ?? []).some((collection) => collection.id === filters.collectionId)) return false;
    if (filters.season && filters.season !== "all" && normalize(prayer.liturgical_season).toLowerCase() !== filters.season.toLowerCase()) return false;
    if (filters.tag && filters.tag !== "all" && !(prayer.tags ?? []).some((tag) => tag.slug === filters.tag || tag.name.toLowerCase() === filters.tag.toLowerCase())) return false;
    return prayerMatchesCmsSearch(prayer, filters.search ?? "");
  });
}

export function validatePrayerContent(
  prayer: CatholicPrayerContent,
  reference: Partial<CmsReferenceLookup> = {},
  allPrayers: CatholicPrayerContent[] = [],
): PrayerContentIssue[] {
  const issues: PrayerContentIssue[] = [];
  const title = normalize(prayer.title);
  const body = normalize(prayer.body);
  const slug = normalize(prayer.slug).toLowerCase();
  const status = normalize(prayer.status).toLowerCase();
  const visibility = normalize(prayer.visibility).toLowerCase();
  const provenance = classifyPrayerProvenance(prayer);

  if (!title) issues.push({ field: "Title", severity: "error", message: "Title is required." });
  if (!body) issues.push({ field: "Prayer Body", severity: "error", message: "Prayer Body is required." });
  if (slug && allPrayers.some((item) => item.id !== prayer.id && normalize(item.slug).toLowerCase() === slug)) {
    issues.push({ field: "Slug", severity: "error", message: "Duplicate slug exists in the Prayer Library." });
  }
  if (!VALID_CONTENT_STATUSES.includes(status as never)) {
    issues.push({ field: "Status", severity: "error", message: `Status must be one of: ${VALID_CONTENT_STATUSES.join(", ")}.` });
  }
  if (!VALID_VISIBILITIES.includes(visibility as never)) {
    issues.push({ field: "Visibility", severity: "error", message: `Visibility must be one of: ${VALID_VISIBILITIES.join(", ")}.` });
  }
  if (prayer.language_id && reference.languages?.length && !reference.languages.some((language) => language.id === prayer.language_id)) {
    issues.push({ field: "Language", severity: "error", message: "Selected language no longer exists." });
  }
  if (prayer.category_id && reference.categories?.length && !reference.categories.some((category) => category.id === prayer.category_id)) {
    issues.push({ field: "Category", severity: "error", message: "Selected category no longer exists." });
  }

  if (!normalize(prayer.summary)) issues.push({ field: "Summary", severity: "warning", message: "Summary is missing." });
  if (!prayer.category_id) issues.push({ field: "Category", severity: "warning", message: "Category is missing." });
  if (!normalize(prayer.source)) issues.push({ field: "Source", severity: "warning", message: "Source is missing." });
  if (provenance === "unknown_source") issues.push({ field: "Provenance", severity: "warning", message: "Source is unknown and needs editorial review." });
  if (!normalize(prayer.author) && !["traditional_public_domain", "original_kanisa_connect_content"].includes(provenance)) {
    issues.push({ field: "Author", severity: "warning", message: "Author is missing where attribution may be expected." });
  }
  if (!(prayer.tags ?? []).length) issues.push({ field: "Tags", severity: "warning", message: "No tags assigned." });
  if (!(prayer.collections ?? []).length) issues.push({ field: "Collection", severity: "warning", message: "No collection assigned." });
  if (body && body.split(" ").filter(Boolean).length < 8) {
    issues.push({ field: "Prayer Body", severity: "warning", message: "Prayer body is suspiciously short." });
  }

  if (prayer.featured || prayer.status === "featured") issues.push({ field: "Featured", severity: "information", message: "Featured prayer." });
  if (normalize(prayer.liturgical_season)) issues.push({ field: "Liturgical Season", severity: "information", message: "Seasonal prayer." });
  if (normalize(prayer.scripture_reference)) issues.push({ field: "Scripture Reference", severity: "information", message: "Scripture-linked prayer." });
  if (provenance === "original_kanisa_connect_content") issues.push({ field: "Provenance", severity: "information", message: "Original Kanisa Connect content." });

  return issues;
}

export function validatePrayerPublicationSafety(
  prayers: CatholicPrayerContent[],
  reference: Partial<CmsReferenceLookup> = {},
  allPrayers: CatholicPrayerContent[] = prayers,
): PrayerPublicationSafetyResult {
  const records = prayers.map((prayer) => {
    const issues = validatePrayerContent(prayer, reference, allPrayers);
    const publicationIssues = [...issues];

    if (!["public", "member"].includes(prayer.visibility)) {
      publicationIssues.push({ field: "Visibility", severity: "error", message: "Prayer must be public or member-visible before publication." });
    }
    if (prayer.featured && !["public", "member"].includes(prayer.visibility)) {
      publicationIssues.push({ field: "Featured", severity: "error", message: "Featured prayers must be member-visible." });
    }

    const errors = publicationIssues.filter((issue) => issue.severity === "error");
    const warnings = publicationIssues.filter((issue) => issue.severity === "warning");
    return { prayer, issues: publicationIssues, errors, warnings };
  });

  const blockedRecords = records.filter((record) => record.errors.length > 0);
  const validRecords = records.filter((record) => record.errors.length === 0);

  return {
    selectedRecords: prayers.length,
    validRecords,
    blockedRecords,
    warnings: records.flatMap((record) => record.warnings),
    canPublish: prayers.length > 0 && blockedRecords.length === 0,
  };
}

function referenceMap<T extends { id: string; name?: string; title?: string; slug?: string; code?: string }>(items: T[]) {
  const map = new Map<string, T>();
  items.forEach((item) => {
    [item.id, item.slug, item.name, item.title, item.code].filter(Boolean).forEach((key) => map.set(String(key).toLowerCase(), item));
  });
  return map;
}

export function validatePrayerImportRows(rows: CmsImportRow[], reference: CmsReferenceLookup, existingPrayers: CatholicPrayerContent[] = []): CmsImportValidation {
  const issues: CmsImportIssue[] = [];
  const seenSlugs = new Set<string>();
  const seenTitles = new Set<string>();
  const existingSlugs = new Set(existingPrayers.map((prayer) => prayer.slug.toLowerCase()));
  const categories = referenceMap(reference.categories);
  const languages = referenceMap(reference.languages);
  const tags = referenceMap(reference.tags);
  const collections = referenceMap(reference.collections);

  rows.forEach((row) => {
    const title = normalize(row.title);
    const body = normalize(row.prayerBody);
    const slug = cmsSlugify(normalize(row.slug) || title);
    const status = normalize(row.status || "draft").toLowerCase();
    const visibility = normalize(row.visibility || "member").toLowerCase();

    if (!title) issues.push({ rowNumber: row.rowNumber, field: "Title", severity: "error", message: "Title is required." });
    if (!body) issues.push({ rowNumber: row.rowNumber, field: "Prayer Body", severity: "error", message: "Prayer Body is required." });
    if (!VALID_CONTENT_STATUSES.includes(status as never)) issues.push({ rowNumber: row.rowNumber, field: "Status", severity: "error", message: `Status must be one of: ${VALID_CONTENT_STATUSES.join(", ")}.` });
    if (!VALID_VISIBILITIES.includes(visibility as never)) issues.push({ rowNumber: row.rowNumber, field: "Visibility", severity: "error", message: `Visibility must be one of: ${VALID_VISIBILITIES.join(", ")}.` });
    if (slug && seenSlugs.has(slug)) issues.push({ rowNumber: row.rowNumber, field: "Slug", severity: "error", message: "Duplicate slug in this import file." });
    if (slug && existingSlugs.has(slug)) issues.push({ rowNumber: row.rowNumber, field: "Slug", severity: "warning", message: "Existing slug will update the matching CMS prayer." });
    if (title && seenTitles.has(title.toLowerCase())) issues.push({ rowNumber: row.rowNumber, field: "Title", severity: "warning", message: "Duplicate title in this import file." });
    if (row.category && !categories.has(normalize(row.category).toLowerCase())) issues.push({ rowNumber: row.rowNumber, field: "Category", severity: "error", message: `Unknown category: ${row.category}.` });
    if (row.language && !languages.has(normalize(row.language).toLowerCase())) issues.push({ rowNumber: row.rowNumber, field: "Language", severity: "error", message: `Unknown language: ${row.language}.` });
    if (row.collection && !collections.has(normalize(row.collection).toLowerCase())) issues.push({ rowNumber: row.rowNumber, field: "Collection", severity: "error", message: `Unknown collection: ${row.collection}.` });

    normalize(row.tags)
      .split(",")
      .map((tag) => normalize(tag))
      .filter(Boolean)
      .forEach((tag) => {
        if (!tags.has(tag.toLowerCase())) issues.push({ rowNumber: row.rowNumber, field: "Tags", severity: "warning", message: `Unknown tag will be created: ${tag}.` });
      });

    if (slug) seenSlugs.add(slug);
    if (title) seenTitles.add(title.toLowerCase());
    if (!normalize(row.summary)) issues.push({ rowNumber: row.rowNumber, field: "Summary", severity: "warning", message: "Summary is missing." });
    if (!normalize(row.category)) issues.push({ rowNumber: row.rowNumber, field: "Category", severity: "warning", message: "Category is missing." });
    if (!normalize(row.source)) issues.push({ rowNumber: row.rowNumber, field: "Source", severity: "warning", message: "Source is missing." });
    if (!normalize(row.tags)) issues.push({ rowNumber: row.rowNumber, field: "Tags", severity: "warning", message: "No tags assigned." });
    if (!normalize(row.collection)) issues.push({ rowNumber: row.rowNumber, field: "Collection", severity: "warning", message: "No collection assigned." });
    if (body && body.split(" ").filter(Boolean).length < 8) issues.push({ rowNumber: row.rowNumber, field: "Prayer Body", severity: "warning", message: "Prayer body is suspiciously short." });
    if (normalize(row.featured).toLowerCase() === "true" || normalize(row.featured).toLowerCase() === "yes") issues.push({ rowNumber: row.rowNumber, field: "Featured", severity: "information", message: "Featured prayer." });
    if (normalize(row.liturgicalSeason)) issues.push({ rowNumber: row.rowNumber, field: "Liturgical Season", severity: "information", message: "Seasonal prayer." });
    if (normalize(row.scriptureReference)) issues.push({ rowNumber: row.rowNumber, field: "Scripture Reference", severity: "information", message: "Scripture-linked prayer." });
    if (normalize(row.source).toLowerCase().includes("kanisa") || normalize(row.author).toLowerCase().includes("kanisa")) {
      issues.push({ rowNumber: row.rowNumber, field: "Provenance", severity: "information", message: "Original Kanisa Connect content." });
    }
  });

  const errorRows = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.rowNumber));

  return {
    validRows: rows.filter((row) => !errorRows.has(row.rowNumber)),
    issues,
    hasErrors: errorRows.size > 0,
  };
}

export function importRowToDraft(row: CmsImportRow, reference: CmsReferenceLookup, existing?: CatholicPrayerContent): PrayerEditorDraft {
  const categories = referenceMap(reference.categories);
  const languages = referenceMap(reference.languages);
  const collections = referenceMap(reference.collections);
  const collection = row.collection ? collections.get(normalize(row.collection).toLowerCase()) : null;
  const title = normalize(row.title);

  return {
    id: existing?.id ?? `draft-import-${row.rowNumber}`,
    title,
    slug: cmsSlugify(normalize(row.slug) || title),
    summary: normalize(row.summary),
    body: normalize(row.prayerBody),
    category_id: row.category ? categories.get(normalize(row.category).toLowerCase())?.id ?? null : null,
    language_id: row.language ? languages.get(normalize(row.language).toLowerCase())?.id ?? null : null,
    status: (normalize(row.status || "draft").toLowerCase() as PrayerEditorDraft["status"]) || "draft",
    featured: row.featured === true || normalize(row.featured).toLowerCase() === "true" || normalize(row.featured).toLowerCase() === "yes",
    visibility: (normalize(row.visibility || "member").toLowerCase() as PrayerEditorDraft["visibility"]) || "member",
    author: normalize(row.author),
    source: normalize(row.source),
    liturgical_season: normalize(row.liturgicalSeason),
    scripture_reference: normalize(row.scriptureReference),
    estimated_read_time: existing?.estimated_read_time ?? null,
    cover_image: existing?.cover_image ?? "",
    tag_names: normalize(row.tags),
    collection_ids: collection ? [collection.id] : [],
  };
}

export function buildPrayerRestoreDraft(current: CatholicPrayerContent, versionSnapshot: Partial<CatholicPrayerContent>): PrayerEditorDraft {
  return {
    id: current.id,
    title: versionSnapshot.title ?? current.title,
    slug: current.slug,
    summary: versionSnapshot.summary ?? "",
    body: versionSnapshot.body ?? current.body,
    category_id: versionSnapshot.category_id ?? current.category_id,
    language_id: versionSnapshot.language_id ?? current.language_id,
    status: versionSnapshot.status ?? current.status,
    featured: versionSnapshot.featured ?? current.featured,
    visibility: versionSnapshot.visibility ?? current.visibility,
    author: versionSnapshot.author ?? "",
    source: versionSnapshot.source ?? "",
    liturgical_season: versionSnapshot.liturgical_season ?? "",
    scripture_reference: versionSnapshot.scripture_reference ?? "",
    estimated_read_time: versionSnapshot.estimated_read_time ?? current.estimated_read_time,
    cover_image: versionSnapshot.cover_image ?? "",
    tag_names: (current.tags ?? []).map((tag) => tag.name).join(", "),
    collection_ids: (current.collections ?? []).map((collection) => collection.id),
  };
}

export function buildCmsHealthIssues(prayers: CatholicPrayerContent[], collections: ContentCollection[], relationships: CatholicPrayerRelationship[] = []): CmsHealthIssue[] {
  const issues: CmsHealthIssue[] = [];
  prayers.forEach((prayer) => {
    if (!prayer.category_id) issues.push({ id: `${prayer.id}-category`, title: prayer.title, severity: "warning", message: "Missing category." });
    if (!prayer.language_id) issues.push({ id: `${prayer.id}-language`, title: prayer.title, severity: "warning", message: "Missing language." });
    if (!(prayer.tags ?? []).length) issues.push({ id: `${prayer.id}-tags`, title: prayer.title, severity: "info", message: "No tags assigned." });
    if (prayer.status === "review") issues.push({ id: `${prayer.id}-review`, title: prayer.title, severity: "warning", message: "Draft content awaits review." });
  });

  collections.forEach((collection) => {
    const hasItems = prayers.some((prayer) => (prayer.collections ?? []).some((item) => item.id === collection.id));
    if (!hasItems) issues.push({ id: `${collection.id}-empty`, title: collection.title, severity: "info", message: "Collection has no prayers." });
  });

  relationships.forEach((relationship) => {
    if (!relationship.target_id || !relationship.source_id) issues.push({ id: relationship.id, title: relationship.relationship_type, severity: "error", message: "Broken relationship target." });
  });

  return issues;
}
