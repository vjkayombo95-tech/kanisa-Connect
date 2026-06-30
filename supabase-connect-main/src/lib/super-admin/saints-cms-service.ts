import { supabase } from "@/integrations/supabase/client";
import { SAINT_SELECT, type LibrarySaint } from "@/lib/catholic-library";

export type AdminSaint = LibrarySaint & {
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SaintEditorPayload = {
  name: string;
  title: string | null;
  country: string | null;
  feast_month: number;
  feast_day: number;
  patron_of: string | null;
  biography_short: string;
  biography_long: string;
  quote: string | null;
  reflection: string;
  prayer: string;
  tags: string[] | null;
  is_featured: boolean;
  is_active: boolean;
};

export type CatholicDashboardStats = {
  totalSaints: number;
  featuredSaints: number;
  publishedSaints: number;
  inactiveSaints: number;
  saintsMissingImages: number;
  recentSaints: AdminSaint[];
};

export async function fetchSaintsForAdmin() {
  const { data, error } = await supabase
    .from("saints" as never)
    .select(`${SAINT_SELECT}, is_active, created_at, updated_at`)
    .order("name", { ascending: true })
    .limit(1000);

  if (error) throw error;
  return (data ?? []) as unknown as AdminSaint[];
}

async function countSaints(filter?: { column: "is_featured" | "is_active"; value: boolean }) {
  let query = supabase.from("saints" as never).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchCatholicDashboardStats(): Promise<CatholicDashboardStats> {
  const [totalSaints, featuredSaints, publishedSaints, inactiveSaints, imageRowsResult, recentResult] = await Promise.all([
    countSaints(),
    countSaints({ column: "is_featured", value: true }),
    countSaints({ column: "is_active", value: true }),
    countSaints({ column: "is_active", value: false }),
    supabase
      .from("saints" as never)
      .select("id, image_url")
      .limit(1000),
    supabase
      .from("saints" as never)
      .select(`${SAINT_SELECT}, is_active, created_at, updated_at`)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  if (imageRowsResult.error) throw imageRowsResult.error;
  if (recentResult.error) throw recentResult.error;

  return {
    totalSaints,
    featuredSaints,
    publishedSaints,
    inactiveSaints,
    saintsMissingImages: ((imageRowsResult.data ?? []) as unknown as { image_url: string | null }[]).filter((saint) => !saint.image_url?.trim()).length,
    recentSaints: (recentResult.data ?? []) as unknown as AdminSaint[],
  };
}

export async function updateSaint(id: string, payload: Partial<SaintEditorPayload>) {
  const { error } = await supabase
    .from("saints" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) throw error;
}

export async function softDeleteSaint(id: string) {
  await updateSaint(id, { is_active: false });
}

async function findAvailableCopySlug(slug: string) {
  const baseSlug = `${slug}-copy`;
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data, error } = await supabase
      .from("saints" as never)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function duplicateSaintRecord(saint: AdminSaint) {
  const copySlug = await findAvailableCopySlug(saint.slug);
  const payload = {
    slug: copySlug,
    name: `${saint.name} Copy`,
    title: saint.title,
    feast_month: saint.feast_month,
    feast_day: saint.feast_day,
    patron_of: saint.patron_of,
    birth_year: saint.birth_year,
    death_year: saint.death_year,
    country: saint.country,
    biography_short: saint.biography_short,
    biography_long: saint.biography_long,
    quote: saint.quote,
    reflection: saint.reflection,
    prayer: saint.prayer,
    image_url: saint.image_url,
    color_theme: saint.color_theme,
    liturgical_rank: saint.liturgical_rank,
    is_featured: false,
    scripture_reference: saint.scripture_reference,
    tags: saint.tags,
    is_active: false,
  };

  const { data, error } = await supabase.from("saints" as never).insert(payload as never).select("id, slug, name").single();
  if (error) throw error;
  return data as unknown as { id: string; slug: string; name: string };
}
