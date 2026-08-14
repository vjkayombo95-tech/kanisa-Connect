import { supabase } from "@/integrations/supabase/client";

export type PublishedReflection = { id: string; reading_date: string; liturgical_season: string | null; gospel: string | null; reflection: string };
export type PublishedPrayer = { id: string; title: string; slug: string; summary: string | null; body: string; status: "published" | "featured"; featured: boolean };

const REFLECTION_SELECT = "id, reading_date, liturgical_season, gospel, reflection, is_published";
const PRAYER_SELECT = "id, title, slug, summary, body, status, featured";

export async function fetchPublishedReflections() {
  const { data, error } = await supabase.from("daily_readings" as never).select(REFLECTION_SELECT).eq("is_published", true).not("reflection", "is", null).order("reading_date", { ascending: false }).limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as PublishedReflection[]).filter((item) => item.reflection.trim().length > 0);
}

export async function fetchPublishedReflection(id: string) {
  const { data, error } = await supabase.from("daily_readings" as never).select(REFLECTION_SELECT).eq("id", id).eq("is_published", true).not("reflection", "is", null).maybeSingle();
  if (error) throw error;
  const item = data as unknown as PublishedReflection | null;
  return item?.reflection.trim() ? item : null;
}

export async function fetchPublishedPrayers() {
  const { data, error } = await supabase.from("content_prayers" as never).select(PRAYER_SELECT).in("status", ["published", "featured"]).order("featured", { ascending: false }).order("title");
  if (error) throw error;
  return (data ?? []) as unknown as PublishedPrayer[];
}

export async function fetchPublishedPrayer(slug: string) {
  const { data, error } = await supabase.from("content_prayers" as never).select(PRAYER_SELECT).eq("slug", slug).in("status", ["published", "featured"]).maybeSingle();
  if (error) throw error;
  return data as unknown as PublishedPrayer | null;
}
