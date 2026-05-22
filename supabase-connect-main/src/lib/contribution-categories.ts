import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_CONTRIBUTION_CATEGORIES = [
  { name: "Tithe", description: "Regular tithe", is_special: false },
  { name: "Offering", description: "General offering", is_special: false },
  { name: "Building Fund", description: "Church building fund", is_special: true },
  { name: "Donations", description: "General donations", is_special: false },
] as const;

export async function fetchContributionCategories(churchId: string) {
  const { data, error } = await supabase
    .from("contribution_categories")
    .select("id, name")
    .eq("church_id", churchId)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function ensureDefaultContributionCategories(churchId: string) {
  const existingCategories = await fetchContributionCategories(churchId);

  if (existingCategories.length > 0) {
    return existingCategories;
  }

  const { error } = await supabase
    .from("contribution_categories")
    .insert(
      DEFAULT_CONTRIBUTION_CATEGORIES.map((category) => ({
        church_id: churchId,
        name: category.name,
        description: category.description,
        is_special: category.is_special,
      })),
    );

  if (error) throw error;

  return fetchContributionCategories(churchId);
}
