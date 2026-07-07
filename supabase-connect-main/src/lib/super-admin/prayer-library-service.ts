import { supabase } from "@/integrations/supabase/client";
import {
  buildPrayerRestoreDraft,
  filterMemberPrayers,
  importRowToDraft,
  prayerMatchesCmsSearch,
  validatePrayerContent,
  validatePrayerImportRows,
  validatePrayerPublicationSafety,
  type CmsHealthIssue,
  type CmsImportRow,
  type CmsImportValidation,
  type PrayerPublicationSafetyResult,
} from "@/lib/catholic-cms/prayer-engine";
import { buildCmsHealthIssues } from "@/lib/catholic-cms/prayer-engine";

export const CMS_CONTENT_STATUSES = ["draft", "review", "published", "featured", "archived"] as const;
export const CMS_VISIBILITIES = ["public", "member", "pastoral", "admin"] as const;

export type CmsContentStatus = (typeof CMS_CONTENT_STATUSES)[number];
export type CmsVisibility = (typeof CMS_VISIBILITIES)[number];

export type ContentCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ContentTag = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
};

export type ContentLanguage = {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_default: boolean;
};

export type ContentCollection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  featured: boolean;
  status: CmsContentStatus;
};

export type CatholicPrayerContent = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  category_id: string | null;
  language_id: string | null;
  status: CmsContentStatus;
  featured: boolean;
  visibility: CmsVisibility;
  author: string | null;
  source: string | null;
  liturgical_season: string | null;
  scripture_reference: string | null;
  estimated_read_time: number | null;
  cover_image: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  category?: Pick<ContentCategory, "id" | "name" | "slug" | "color"> | null;
  language?: Pick<ContentLanguage, "id" | "code" | "name" | "native_name"> | null;
  tags?: ContentTag[];
  collections?: ContentCollection[];
};

export type CatholicPrayerVersion = {
  id: string;
  content_type: "prayer";
  content_id: string;
  version_number: number;
  snapshot: CatholicPrayerContent;
  created_by: string | null;
  created_at: string;
};

export type CatholicPrayerRelationship = {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string | null;
  target_key?: string | null;
  relationship_type: string;
  created_at: string;
  target_label?: string | null;
};

export type CatholicPrayerRelationshipInput = {
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType: string;
  targetLabel?: string;
};

export type PrayerEditorDraft = Omit<CatholicPrayerContent, "created_by" | "updated_by" | "created_at" | "updated_at" | "category" | "language" | "tags" | "collections"> & {
  tag_names: string;
  collection_ids: string[];
};

export type PrayerDraft = PrayerEditorDraft;

export type CatholicCmsDashboardStats = {
  publishedContent: number;
  draftContent: number;
  reviewContent: number;
  archivedContent: number;
  collections: number;
  categories: number;
  languages: number;
  todayPrayer: CatholicPrayerContent | null;
  upcomingSeasonalContent: CatholicPrayerContent[];
  recentlyUpdated: CatholicPrayerContent[];
  healthIssues: CmsHealthIssue[];
};

export type CatholicCmsReferenceData = {
  categories: ContentCategory[];
  tags: ContentTag[];
  languages: ContentLanguage[];
  collections: ContentCollection[];
};

export const PRAYER_CATEGORIES = [
  "Morning",
  "Evening",
  "Healing",
  "Family",
  "Children",
  "Marriage",
  "Priests",
  "Marian",
  "Rosary",
  "Chaplets",
  "Novenas",
  "Litanies",
  "Devotions",
  "Thanksgiving",
  "Intercession",
  "Protection",
  "Funeral",
  "Adoration",
  "Eucharistic",
  "Lent",
  "Advent",
  "Christmas",
  "Ordinary Time",
  "Holy Week",
  "Easter",
  "Pentecost",
];

const PRAYER_SELECT = `
  *,
  category:content_categories(id,name,slug,color),
  language:content_languages(id,code,name,native_name)
`;

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `content-${Date.now()}`;
}

function splitNames(value: string) {
  return value
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function estimateReadTime(body: string) {
  const words = normalizeText(body).split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function isCmsPrayerUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getCmsPrayerIdentifierColumn(value: string): "id" | "slug" {
  return isCmsPrayerUuid(value) ? "id" : "slug";
}

function emptyUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `draft-${Date.now()}`;
}

export function createEmptyPrayerDraft(reference?: CatholicCmsReferenceData): PrayerEditorDraft {
  const defaultLanguage = reference?.languages.find((language) => language.is_default) ?? reference?.languages[0] ?? null;
  const defaultCategory = reference?.categories.find((category) => category.slug === "morning") ?? reference?.categories[0] ?? null;

  return {
    id: emptyUuid(),
    title: "",
    slug: "",
    summary: "",
    body: "",
    category_id: defaultCategory?.id ?? null,
    language_id: defaultLanguage?.id ?? null,
    status: "draft",
    featured: false,
    visibility: "member",
    author: "",
    source: "",
    liturgical_season: "",
    scripture_reference: "",
    estimated_read_time: null,
    cover_image: "",
    tag_names: "",
    collection_ids: [],
  };
}

export async function fetchCatholicCmsReferenceData(): Promise<CatholicCmsReferenceData> {
  const [categories, tags, languages, collections] = await Promise.all([
    supabase.from("content_categories" as never).select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    supabase.from("content_tags" as never).select("*").order("name", { ascending: true }),
    supabase.from("content_languages" as never).select("*").order("is_default", { ascending: false }).order("name", { ascending: true }),
    supabase.from("content_collections" as never).select("*").order("featured", { ascending: false }).order("title", { ascending: true }),
  ]);

  if (categories.error) throw categories.error;
  if (tags.error) throw tags.error;
  if (languages.error) throw languages.error;
  if (collections.error) throw collections.error;

  return {
    categories: (categories.data ?? []) as unknown as ContentCategory[],
    tags: (tags.data ?? []) as unknown as ContentTag[],
    languages: (languages.data ?? []) as unknown as ContentLanguage[],
    collections: (collections.data ?? []) as unknown as ContentCollection[],
  };
}

async function attachTaxonomy(prayers: CatholicPrayerContent[]): Promise<CatholicPrayerContent[]> {
  if (!prayers.length) return prayers;
  const ids = prayers.map((prayer) => prayer.id);

  const [tagLinks, collectionLinks] = await Promise.all([
    supabase
      .from("content_prayer_tags" as never)
      .select("prayer_id, tag:content_tags(id,name,slug,description,color)")
      .in("prayer_id", ids as never),
    supabase
      .from("content_collection_items" as never)
      .select("content_id, collection:content_collections(id,title,slug,description,cover_image,featured,status)")
      .eq("content_type", "prayer")
      .in("content_id", ids as never),
  ]);

  if (tagLinks.error) throw tagLinks.error;
  if (collectionLinks.error) throw collectionLinks.error;

  const tagsByPrayer = new Map<string, ContentTag[]>();
  ((tagLinks.data ?? []) as unknown as Array<{ prayer_id: string; tag: ContentTag | null }>).forEach((row) => {
    if (!row.tag) return;
    tagsByPrayer.set(row.prayer_id, [...(tagsByPrayer.get(row.prayer_id) ?? []), row.tag]);
  });

  const collectionsByPrayer = new Map<string, ContentCollection[]>();
  ((collectionLinks.data ?? []) as unknown as Array<{ content_id: string; collection: ContentCollection | null }>).forEach((row) => {
    if (!row.collection) return;
    collectionsByPrayer.set(row.content_id, [...(collectionsByPrayer.get(row.content_id) ?? []), row.collection]);
  });

  return prayers.map((prayer) => ({
    ...prayer,
    tags: tagsByPrayer.get(prayer.id) ?? [],
    collections: collectionsByPrayer.get(prayer.id) ?? [],
  }));
}

export async function fetchPrayerDrafts(): Promise<CatholicPrayerContent[]> {
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(PRAYER_SELECT)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return attachTaxonomy((data ?? []) as unknown as CatholicPrayerContent[]);
}

export async function fetchPublishedCmsPrayers(limit = 24): Promise<CatholicPrayerContent[]> {
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(PRAYER_SELECT)
    .in("status", ["published", "featured"] as never)
    .in("visibility", ["public", "member"] as never)
    .order("featured", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return attachTaxonomy((data ?? []) as unknown as CatholicPrayerContent[]);
}

export async function fetchCmsPrayerByIdOrSlug(idOrSlug: string): Promise<CatholicPrayerContent | null> {
  let query = supabase
    .from("content_prayers" as never)
    .select(PRAYER_SELECT);

  query = query.eq(getCmsPrayerIdentifierColumn(idOrSlug), idOrSlug);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  const [prayer] = await attachTaxonomy(data ? ([data] as unknown as CatholicPrayerContent[]) : []);
  return prayer ?? null;
}

export async function fetchMemberCmsPrayerByIdOrSlug(idOrSlug: string): Promise<CatholicPrayerContent | null> {
  const prayer = await fetchCmsPrayerByIdOrSlug(idOrSlug);
  if (!prayer || !filterMemberPrayers([prayer]).length) return null;
  return prayer;
}

export async function searchPublishedCmsPrayers(query: string, limit = 12): Promise<CatholicPrayerContent[]> {
  const prayers = await fetchPublishedCmsPrayers(250);
  return filterMemberPrayers(prayers)
    .filter((prayer) => prayerMatchesCmsSearch(prayer, query))
    .slice(0, limit);
}

async function findAvailablePrayerSlug(title: string, existingId?: string) {
  const baseSlug = slugify(title);
  for (let index = 0; index < 25; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data, error } = await supabase.from("content_prayers" as never).select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    const row = data as unknown as { id: string } | null;
    if (!row || row.id === existingId) return slug;
  }

  return `${baseSlug}-${Date.now()}`;
}

async function ensureTags(tagNames: string[]) {
  const tags: ContentTag[] = [];

  for (const name of tagNames) {
    const slug = slugify(name);
    const { data, error } = await supabase
      .from("content_tags" as never)
      .upsert({ name, slug } as never, { onConflict: "slug" })
      .select("*")
      .single();

    if (error) throw error;
    tags.push(data as unknown as ContentTag);
  }

  return tags;
}

async function syncPrayerTags(prayerId: string, tagNames: string[]) {
  const tags = await ensureTags(tagNames);
  const { error: deleteError } = await supabase.from("content_prayer_tags" as never).delete().eq("prayer_id", prayerId);
  if (deleteError) throw deleteError;

  if (!tags.length) return;

  const { error } = await supabase.from("content_prayer_tags" as never).insert(
    tags.map((tag) => ({ prayer_id: prayerId, tag_id: tag.id })) as never,
  );
  if (error) throw error;
}

async function syncPrayerCollections(prayerId: string, collectionIds: string[]) {
  const { error: deleteError } = await supabase
    .from("content_collection_items" as never)
    .delete()
    .eq("content_type", "prayer")
    .eq("content_id", prayerId);

  if (deleteError) throw deleteError;
  if (!collectionIds.length) return;

  const { error } = await supabase.from("content_collection_items" as never).insert(
    collectionIds.map((collectionId, index) => ({
      collection_id: collectionId,
      content_type: "prayer",
      content_id: prayerId,
      sort_order: index + 1,
    })) as never,
  );
  if (error) throw error;
}

export function prayerToEditorDraft(prayer: CatholicPrayerContent): PrayerEditorDraft {
  return {
    id: prayer.id,
    title: prayer.title,
    slug: prayer.slug,
    summary: prayer.summary ?? "",
    body: prayer.body,
    category_id: prayer.category_id,
    language_id: prayer.language_id,
    status: prayer.status,
    featured: prayer.featured,
    visibility: prayer.visibility,
    author: prayer.author ?? "",
    source: prayer.source ?? "",
    liturgical_season: prayer.liturgical_season ?? "",
    scripture_reference: prayer.scripture_reference ?? "",
    estimated_read_time: prayer.estimated_read_time,
    cover_image: prayer.cover_image ?? "",
    tag_names: (prayer.tags ?? []).map((tag) => tag.name).join(", "),
    collection_ids: (prayer.collections ?? []).map((collection) => collection.id),
  };
}

export async function savePrayerDraft(draft: PrayerEditorDraft): Promise<CatholicPrayerContent> {
  const existing = draft.id && !draft.id.startsWith("draft-")
    ? await supabase.from("content_prayers" as never).select("id").eq("id", draft.id).maybeSingle()
    : { data: null, error: null };

  if (existing.error) throw existing.error;

  const isExisting = Boolean(existing.data);
  const slug = normalizeText(draft.slug) || (await findAvailablePrayerSlug(draft.title, isExisting ? draft.id : undefined));
  const payload = {
    title: normalizeText(draft.title) || "Untitled Prayer",
    slug,
    summary: normalizeText(draft.summary) || null,
    body: draft.body.trim(),
    category_id: draft.category_id || null,
    language_id: draft.language_id || null,
    status: draft.status,
    featured: draft.featured || draft.status === "featured",
    visibility: draft.visibility,
    author: normalizeText(draft.author) || null,
    source: normalizeText(draft.source) || null,
    liturgical_season: normalizeText(draft.liturgical_season) || null,
    scripture_reference: normalizeText(draft.scripture_reference) || null,
    estimated_read_time: draft.estimated_read_time || estimateReadTime(draft.body),
    cover_image: normalizeText(draft.cover_image) || null,
    updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  };

  const query = isExisting
    ? supabase.from("content_prayers" as never).update(payload as never).eq("id", draft.id).select(PRAYER_SELECT).single()
    : supabase
        .from("content_prayers" as never)
        .insert({ ...payload, created_by: payload.updated_by } as never)
        .select(PRAYER_SELECT)
        .single();

  const { data, error } = await query;
  if (error) throw error;

  const saved = data as unknown as CatholicPrayerContent;
  await syncPrayerTags(saved.id, splitNames(draft.tag_names));
  await syncPrayerCollections(saved.id, draft.collection_ids);

  const [hydrated] = await attachTaxonomy([saved]);
  return hydrated;
}

export async function deletePrayerDraft(id: string) {
  const { error } = await supabase.from("content_prayers" as never).delete().eq("id", id);
  if (error) throw error;
}

export function validatePrayerForPublication(
  prayers: CatholicPrayerContent[],
  reference: Partial<CatholicCmsReferenceData> = {},
  allPrayers: CatholicPrayerContent[] = prayers,
): PrayerPublicationSafetyResult {
  return validatePrayerPublicationSafety(prayers, reference, allPrayers);
}

export function validatePrayerForEditorialReview(
  prayer: CatholicPrayerContent,
  reference: Partial<CatholicCmsReferenceData> = {},
  allPrayers: CatholicPrayerContent[] = [],
) {
  return validatePrayerContent(prayer, reference, allPrayers);
}

export async function updatePrayerLifecycleStatus(prayer: CatholicPrayerContent, status: CmsContentStatus): Promise<CatholicPrayerContent> {
  if (status === "published" || status === "featured") {
    const safety = validatePrayerPublicationSafety([prayer], {}, [prayer]);
    if (!safety.canPublish) {
      throw new Error(safety.blockedRecords[0]?.errors[0]?.message ?? "Prayer is not ready to publish.");
    }
  }

  return savePrayerDraft({
    ...prayerToEditorDraft(prayer),
    status,
    featured: status === "featured" ? true : prayer.featured,
  });
}

export async function bulkUpdatePrayerLifecycleStatus(prayers: CatholicPrayerContent[], status: CmsContentStatus): Promise<CatholicPrayerContent[]> {
  if ((status === "published" || status === "featured") && !validatePrayerPublicationSafety(prayers, {}, prayers).canPublish) {
    throw new Error("One or more selected prayers are blocked from publication.");
  }

  const updated: CatholicPrayerContent[] = [];
  for (const prayer of prayers) {
    updated.push(await updatePrayerLifecycleStatus(prayer, status));
  }
  return updated;
}

export async function fetchPrayerVersions(prayerId: string): Promise<CatholicPrayerVersion[]> {
  const { data, error } = await supabase
    .from("content_versions" as never)
    .select("*")
    .eq("content_type", "prayer")
    .eq("content_id", prayerId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CatholicPrayerVersion[];
}

export async function restorePrayerVersion(current: CatholicPrayerContent, version: CatholicPrayerVersion): Promise<CatholicPrayerContent> {
  const draft = buildPrayerRestoreDraft(current, version.snapshot);
  return savePrayerDraft(draft);
}

export async function fetchPrayerRelationships(prayerId: string): Promise<CatholicPrayerRelationship[]> {
  const { data, error } = await supabase
    .from("content_relationships" as never)
    .select("*")
    .eq("source_type", "prayer")
    .eq("source_id", prayerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const relationships = (data ?? []) as unknown as CatholicPrayerRelationship[];
  const prayerIds = relationships.filter((item) => item.target_type === "prayer" && item.target_id).map((item) => item.target_id!);

  if (!prayerIds.length) return relationships;

  const { data: prayers, error: prayerError } = await supabase
    .from("content_prayers" as never)
    .select("id,title,slug")
    .in("id", prayerIds as never);

  if (prayerError) throw prayerError;
  const labels = new Map(((prayers ?? []) as unknown as Array<{ id: string; title: string }>).map((prayer) => [prayer.id, prayer.title]));

  return relationships.map((relationship) => ({
    ...relationship,
    target_label: (relationship.target_id ? labels.get(relationship.target_id) : null) ?? relationship.target_label ?? relationship.target_key ?? relationship.target_id,
  }));
}

export async function addPrayerRelationship(input: CatholicPrayerRelationshipInput): Promise<CatholicPrayerRelationship> {
  if (!input.sourceId || !input.targetId || !input.targetType || !input.relationshipType) {
    throw new Error("Relationship target and type are required.");
  }

  const { data, error } = await supabase
    .from("content_relationships" as never)
    .insert({
      source_type: "prayer",
      source_id: input.sourceId,
      target_type: input.targetType,
      target_id: isCmsPrayerUuid(input.targetId) ? input.targetId : null,
      target_key: isCmsPrayerUuid(input.targetId) ? null : input.targetId,
      target_label: input.targetLabel || input.targetId,
      relationship_type: input.relationshipType,
    } as never)
    .select("*")
    .single();

  if (error) throw error;
  return { ...((data as unknown as CatholicPrayerRelationship) ?? {}), target_label: input.targetLabel };
}

export async function removePrayerRelationship(id: string) {
  const { error } = await supabase.from("content_relationships" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function searchRelationshipTargets(targetType: string, query: string): Promise<Array<{ id: string; label: string; subtitle?: string }>> {
  const term = normalizeText(query);
  if (!term) return [];

  if (targetType === "prayer") {
    const { data, error } = await supabase
      .from("content_prayers" as never)
      .select("id,title,summary,status")
      .ilike("title", `%${term}%`)
      .limit(10);
    if (error) throw error;
    return ((data ?? []) as unknown as Array<{ id: string; title: string; summary: string | null; status: string }>).map((item) => ({
      id: item.id,
      label: item.title,
      subtitle: item.summary ?? item.status,
    }));
  }

  if (targetType === "saint") {
    const { data, error } = await supabase
      .from("saints" as never)
      .select("id,name,title")
      .ilike("name", `%${term}%`)
      .limit(10);
    if (error) throw error;
    return ((data ?? []) as unknown as Array<{ id: string; name: string; title: string | null }>).map((item) => ({
      id: item.id,
      label: item.name,
      subtitle: item.title ?? "Saint",
    }));
  }

  if (targetType === "collection") {
    const { data, error } = await supabase
      .from("content_collections" as never)
      .select("id,title,description")
      .ilike("title", `%${term}%`)
      .limit(10);
    if (error) throw error;
    return ((data ?? []) as unknown as Array<{ id: string; title: string; description: string | null }>).map((item) => ({
      id: item.id,
      label: item.title,
      subtitle: item.description ?? "Collection",
    }));
  }

  return [];
}

export async function validatePrayerImport(rows: CmsImportRow[]): Promise<CmsImportValidation> {
  const [reference, existingPrayers] = await Promise.all([fetchCatholicCmsReferenceData(), fetchPrayerDrafts()]);
  return validatePrayerImportRows(rows, reference, existingPrayers);
}

export async function importPrayerRows(rows: CmsImportRow[]) {
  const reference = await fetchCatholicCmsReferenceData();
  const existingPrayers = await fetchPrayerDrafts();
  const validation = validatePrayerImportRows(rows, reference, existingPrayers);
  if (validation.hasErrors) {
    throw new Error("Fix import validation errors before confirming import.");
  }

  const existingBySlug = new Map(existingPrayers.map((prayer) => [prayer.slug.toLowerCase(), prayer]));
  const imported: CatholicPrayerContent[] = [];

  for (const row of validation.validRows) {
    const slug = (row.slug || row.title || "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const draft = importRowToDraft(row, reference, existingBySlug.get(slug));
    imported.push(await savePrayerDraft(draft));
  }

  return { imported, validation };
}

export async function createContentCategory(input: { name: string; description?: string; color?: string }) {
  const name = normalizeText(input.name);
  if (!name) throw new Error("Category name is required.");

  const { data, error } = await supabase
    .from("content_categories" as never)
    .upsert(
      {
        name,
        slug: slugify(name),
        description: normalizeText(input.description) || null,
        color: normalizeText(input.color) || null,
        is_active: true,
      } as never,
      { onConflict: "slug" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as ContentCategory;
}

export async function createContentCollection(input: { title: string; description?: string; featured?: boolean }) {
  const title = normalizeText(input.title);
  if (!title) throw new Error("Collection title is required.");

  const { data, error } = await supabase
    .from("content_collections" as never)
    .upsert(
      {
        title,
        slug: slugify(title),
        description: normalizeText(input.description) || null,
        featured: Boolean(input.featured),
        status: "published",
      } as never,
      { onConflict: "slug" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as ContentCollection;
}

async function countRows(table: string, filter?: { column: string; value: string | boolean }) {
  let query = supabase.from(table as never).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value as never);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchCatholicCmsDashboardStats(): Promise<CatholicCmsDashboardStats> {
  const [publishedContent, draftContent, reviewContent, archivedContent, collections, categories, languages, todayPrayers, seasonal, recent, allPrayers, relationships, reference] = await Promise.all([
    countRows("content_prayers", { column: "status", value: "published" }),
    countRows("content_prayers", { column: "status", value: "draft" }),
    countRows("content_prayers", { column: "status", value: "review" }),
    countRows("content_prayers", { column: "status", value: "archived" }),
    countRows("content_collections"),
    countRows("content_categories"),
    countRows("content_languages"),
    supabase
      .from("content_prayers" as never)
      .select(PRAYER_SELECT)
      .in("status", ["published", "featured"] as never)
      .order("featured", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("content_prayers" as never)
      .select(PRAYER_SELECT)
      .in("status", ["published", "featured", "review"] as never)
      .not("liturgical_season", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("content_prayers" as never)
      .select(PRAYER_SELECT)
      .order("updated_at", { ascending: false })
      .limit(6),
    fetchPrayerDrafts(),
    supabase.from("content_relationships" as never).select("*").limit(1000),
    fetchCatholicCmsReferenceData(),
  ]);

  if (todayPrayers.error) throw todayPrayers.error;
  if (seasonal.error) throw seasonal.error;
  if (recent.error) throw recent.error;
  if (relationships.error) throw relationships.error;

  const todayPrayer = ((todayPrayers.data ?? []) as unknown as CatholicPrayerContent[])[0] ?? null;

  return {
    publishedContent,
    draftContent,
    reviewContent,
    archivedContent,
    collections,
    categories,
    languages,
    todayPrayer,
    upcomingSeasonalContent: (seasonal.data ?? []) as unknown as CatholicPrayerContent[],
    recentlyUpdated: (recent.data ?? []) as unknown as CatholicPrayerContent[],
    healthIssues: buildCmsHealthIssues(allPrayers, reference.collections, (relationships.data ?? []) as unknown as CatholicPrayerRelationship[]),
  };
}
