import { supabase } from "@/integrations/supabase/client";
import type { PrayerAdminInput, PrayerCategory, PrayerDetail, PrayerStatus, PrayerSummary } from "@/types/prayer-library";

const LIST_SELECT = "id,prayer_code,parent_prayer_id,title,slug,summary,category_id,language_id,status,featured,prayer_type,recommended_time,audio_url,sort_order,is_global,church_id,liturgical_season,scripture_reference,updated_at,translation_group_id,translation_key,category:content_categories(id,name,slug,icon),language:content_languages(id,code,name,native_name)";
const DETAIL_SELECT = `${LIST_SELECT},body,metadata,source,source_title,source_type,source_organization,source_reference,source_url,source_notes,copyright_holder,copyright_notice,license_type,license_reference,content_edition,content_version_label,ecclesial_approval_status,ecclesial_approval_authority,ecclesial_approval_reference,reviewed_by,reviewed_at`;

export const prayerLibraryKeys = {
  all: ["prayer-library"] as const,
  categories: ["prayer-library", "categories"] as const,
  published: (churchId: string | null) => ["prayer-library", "published", churchId] as const,
  detail: (slug: string) => ["prayer-library", "detail", slug] as const,
  favorites: (userId: string | null) => ["prayer-library", "favorites", userId] as const,
  recent: (userId: string | null) => ["prayer-library", "recent", userId] as const,
  admin: (churchId: string, page: number, filters: unknown) => ["prayer-library", "admin", churchId, page, filters] as const,
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function prayerMatchesSearch(prayer: Pick<PrayerDetail, "title" | "summary" | "body">, query: string) {
  const needle = normalize(query).toLocaleLowerCase();
  if (!needle) return true;
  return [prayer.title, prayer.summary, prayer.body].some((value) => (value ?? "").toLocaleLowerCase().includes(needle));
}

export function orderCollectionPrayers<T extends Pick<PrayerSummary, "sort_order" | "title">>(prayers: T[]) {
  return [...prayers].sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title));
}

export function validatePrayerPublish(input: PrayerAdminInput) {
  if (!normalize(input.title)) return "Title is required.";
  if (!input.category_id) return "Category is required.";
  if (!input.language_id) return "Language is required.";
  if (["published", "featured"].includes(input.status) && !normalize(input.body)) return "Prayer text is required before publishing.";
  if (["published", "featured"].includes(input.status) && !input.source_type) return "Chagua Aina ya Chanzo kabla ya kuchapisha.";
  if (["published", "featured"].includes(input.status) && !normalize(input.source_title) && !normalize(input.source_reference)) return "Weka Source Title au Source Reference kabla ya kuchapisha.";
  if (["published", "featured"].includes(input.status) && (!input.license_type || input.license_type === "unknown")) return "Leseni inayojulikana inahitajika kabla ya kuchapisha.";
  if (["published", "featured"].includes(input.status) && (!normalize(input.reviewed_by) || !input.reviewed_at || input.ecclesial_approval_status !== "approved")) return "Mkaguzi, tarehe, na idhini ya kikanisa vinahitajika kabla ya kuchapisha.";
  if (["published", "featured"].includes(input.status) && !normalize(input.ecclesial_approval_authority) && !normalize(input.ecclesial_approval_reference)) return "Weka mamlaka au rejea ya idhini ya kikanisa.";
  if (["published", "featured"].includes(input.status) && input.license_type === "copyright_restricted" && !normalize(input.license_reference)) return "Maudhui yenye copyright_restricted yanahitaji rejea ya ruhusa au leseni.";
  return null;
}

export async function listPrayerCategories(): Promise<PrayerCategory[]> {
  const { data, error } = await supabase
    .from("content_categories" as never)
    .select("id,name,slug,description,icon,sort_order,is_active")
    .eq("is_active" as never, true as never)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PrayerCategory[];
}

export async function listPublishedPrayers(): Promise<PrayerSummary[]> {
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(LIST_SELECT)
    .in("status", ["published", "featured"] as never)
    .in("visibility", ["public", "member"] as never)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PrayerSummary[];
}

export async function searchPublishedPrayers(queryText: string): Promise<PrayerSummary[]> {
  const query = normalize(queryText).replace(/[%_,()]/g, "");
  if (!query) return listPublishedPrayers();
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(LIST_SELECT)
    .in("status", ["published", "featured"] as never)
    .in("visibility", ["public", "member"] as never)
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%,body.ilike.%${query}%`)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PrayerSummary[];
}

export async function getPrayerBySlug(slug: string): Promise<PrayerDetail | null> {
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(DETAIL_SELECT)
    .eq("slug" as never, slug as never)
    .in("status", ["published", "featured"] as never)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as PrayerDetail | null;
}

export async function getPrayerById(id: string): Promise<PrayerDetail | null> {
  const { data, error } = await supabase.from("content_prayers" as never).select(DETAIL_SELECT).eq("id" as never, id as never).in("status", ["published", "featured"] as never).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as PrayerDetail | null;
}

export async function listCollectionChildren(parentId: string): Promise<PrayerDetail[]> {
  const { data, error } = await supabase
    .from("content_prayers" as never)
    .select(DETAIL_SELECT)
    .eq("parent_prayer_id" as never, parentId as never)
    .in("status", ["published", "featured"] as never)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PrayerDetail[];
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("prayer_favorites" as never).select("prayer_id").eq("user_id" as never, userId as never);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ prayer_id: string }>).map((row) => row.prayer_id);
}

export async function togglePrayerFavorite(userId: string, prayerId: string, isFavorite: boolean) {
  if (isFavorite) {
    const { error } = await supabase.from("prayer_favorites" as never).delete().eq("user_id" as never, userId as never).eq("prayer_id" as never, prayerId as never);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("prayer_favorites" as never).upsert({ user_id: userId, prayer_id: prayerId } as never, { onConflict: "user_id,prayer_id" });
  if (error) throw error;
  return true;
}

export async function getRecentPrayerIds(userId: string, limit = 8): Promise<string[]> {
  const { data, error } = await supabase
    .from("prayer_reading_history" as never)
    .select("prayer_id,last_read_at")
    .eq("user_id" as never, userId as never)
    .order("last_read_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ prayer_id: string }>).map((row) => row.prayer_id);
}

export async function updatePrayerReadingHistory(userId: string, prayerId: string) {
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.id !== userId) throw new Error("Cannot update another user's reading history.");
  const { error } = await supabase.rpc("record_prayer_read" as never, { _prayer_id: prayerId } as never);
  if (error) throw error;
}

export type AdminPrayerFilters = { search?: string; categoryId?: string; languageId?: string; status?: PrayerStatus; source?: "all" | "global" | "church" };

export async function listAdminPrayers(churchId: string, page: number, pageSize: number, filters: AdminPrayerFilters) {
  let query = supabase.from("content_prayers" as never).select(DETAIL_SELECT, { count: "exact" }).or(`church_id.eq.${churchId},is_global.eq.true`);
  if (filters.search) query = query.or(`title.ilike.%${filters.search.replace(/[%_,()]/g, "")}%,summary.ilike.%${filters.search.replace(/[%_,()]/g, "")}%`);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.languageId) query = query.eq("language_id", filters.languageId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source === "global") query = query.eq("is_global", true);
  if (filters.source === "church") query = query.eq("church_id", churchId);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as PrayerDetail[], count: count ?? 0 };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required.");
  return data.user.id;
}

function adminPayload(input: PrayerAdminInput) {
  const validation = validatePrayerPublish(input);
  if (validation) throw new Error(validation);
  return {
    title: normalize(input.title), slug: normalize(input.slug), summary: normalize(input.summary) || null,
    body: normalize(input.body) || null, category_id: input.category_id, language_id: input.language_id,
    parent_prayer_id: input.parent_prayer_id || null, status: input.status, prayer_type: input.prayer_type,
    recommended_time: normalize(input.recommended_time) || null, scripture_reference: normalize(input.scripture_reference) || null,
    liturgical_season: normalize(input.liturgical_season) || null, featured: input.featured || input.status === "featured",
    sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0, audio_url: normalize(input.audio_url) || null,
    visibility: "member",
    source_title: normalize(input.source_title) || null, source_type: input.source_type || null,
    source_organization: normalize(input.source_organization) || null, source_reference: normalize(input.source_reference) || null,
    source_url: normalize(input.source_url) || null, source_notes: normalize(input.source_notes) || null,
    copyright_holder: normalize(input.copyright_holder) || null, copyright_notice: normalize(input.copyright_notice) || null,
    license_type: input.license_type || null, license_reference: normalize(input.license_reference) || null,
    content_edition: normalize(input.content_edition) || null, content_version_label: normalize(input.content_version_label) || null,
    ecclesial_approval_status: input.ecclesial_approval_status, ecclesial_approval_authority: normalize(input.ecclesial_approval_authority) || null,
    ecclesial_approval_reference: normalize(input.ecclesial_approval_reference) || null, reviewed_by: normalize(input.reviewed_by) || null,
    reviewed_at: input.reviewed_at || null,
  };
}

export async function createChurchPrayer(churchId: string, input: PrayerAdminInput) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("content_prayers" as never).insert({ ...adminPayload(input), is_global: false, church_id: churchId, created_by: userId, updated_by: userId } as never).select(DETAIL_SELECT).single();
  if (error) throw error;
  return data as unknown as PrayerDetail;
}

export async function updateChurchPrayer(id: string, churchId: string, input: PrayerAdminInput) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("content_prayers" as never).update({ ...adminPayload(input), updated_by: userId } as never).eq("id" as never, id as never).eq("church_id" as never, churchId as never).eq("is_global" as never, false as never).select(DETAIL_SELECT).single();
  if (error) throw error;
  return data as unknown as PrayerDetail;
}

export async function archiveChurchPrayer(id: string, churchId: string) {
  const { error } = await supabase.from("content_prayers" as never).update({ status: "archived" } as never).eq("id" as never, id as never).eq("church_id" as never, churchId as never).eq("is_global" as never, false as never);
  if (error) throw error;
}

export async function deleteChurchPrayer(id: string, churchId: string) {
  const { error } = await supabase.from("content_prayers" as never).delete().eq("id" as never, id as never).eq("church_id" as never, churchId as never).eq("is_global" as never, false as never);
  if (error) throw error;
}

export function prayerToAdminInput(prayer?: PrayerDetail | null): PrayerAdminInput {
  return {
    title: prayer?.title ?? "", slug: prayer?.slug ?? "", summary: prayer?.summary ?? "", body: prayer?.body ?? "",
    category_id: prayer?.category_id ?? "", parent_prayer_id: prayer?.parent_prayer_id ?? null,
    language_id: prayer?.language_id ?? "", status: prayer?.status ?? "draft", prayer_type: prayer?.prayer_type ?? "single",
    recommended_time: prayer?.recommended_time ?? "", scripture_reference: prayer?.scripture_reference ?? "",
    liturgical_season: prayer?.liturgical_season ?? "", featured: prayer?.featured ?? false,
    sort_order: prayer?.sort_order ?? 0, audio_url: prayer?.audio_url ?? "",
    source_title: prayer?.source_title ?? "", source_type: prayer?.source_type ?? "",
    source_organization: prayer?.source_organization ?? "", source_reference: prayer?.source_reference ?? "",
    source_url: prayer?.source_url ?? "", source_notes: prayer?.source_notes ?? "",
    copyright_holder: prayer?.copyright_holder ?? "", copyright_notice: prayer?.copyright_notice ?? "",
    license_type: prayer?.license_type ?? "", license_reference: prayer?.license_reference ?? "",
    content_edition: prayer?.content_edition ?? "", content_version_label: prayer?.content_version_label ?? "",
    ecclesial_approval_status: prayer?.ecclesial_approval_status ?? "pending",
    ecclesial_approval_authority: prayer?.ecclesial_approval_authority ?? "", ecclesial_approval_reference: prayer?.ecclesial_approval_reference ?? "",
    reviewed_by: prayer?.reviewed_by ?? "", reviewed_at: prayer?.reviewed_at ?? "",
  };
}

export async function listPublishedTranslations(prayer: Pick<PrayerDetail, "id" | "translation_group_id">): Promise<PrayerSummary[]> {
  const { data, error } = await supabase.from("content_prayers" as never).select(LIST_SELECT).eq("translation_group_id" as never, prayer.translation_group_id as never).neq("id" as never, prayer.id as never).in("status", ["published", "featured"] as never).in("visibility", ["public", "member"] as never);
  if (error) throw error;
  return (data ?? []) as unknown as PrayerSummary[];
}
