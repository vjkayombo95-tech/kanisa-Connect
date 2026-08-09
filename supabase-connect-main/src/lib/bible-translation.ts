import { supabase } from "@/integrations/supabase/client";

export const PRIMARY_BIBLE_TRANSLATION_CODE = "sw-open-bible";

export type BibleTranslationAttribution = {
  id: string;
  code: string;
  name: string;
  language_code: string;
  canon_type?: string | null;
  publisher?: string | null;
  copyright_notice?: string | null;
  license_name: string | null;
  license_url: string | null;
  source_url?: string | null;
  attribution_text?: string | null;
  source?: string | null;
  attribution?: string | null;
  audio_generation_allowed: boolean | null;
  ai_processing_allowed?: boolean | null;
  active?: boolean | null;
  default_translation?: boolean | null;
  created_at?: string | null;
  book_count?: number | null;
  chapter_count?: number | null;
  verse_count?: number | null;
};

export function isMissingBibleTranslationMetadataColumn(error: { message?: string; details?: string; hint?: string; code?: string }) {
  const text = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ").toLowerCase();
  return (
    (text.includes("license_name") ||
      text.includes("license_url") ||
      text.includes("source") ||
      text.includes("attribution") ||
      text.includes("canon_type") ||
      text.includes("copyright_notice") ||
      text.includes("source_url") ||
      text.includes("attribution_text") ||
      text.includes("ai_processing_allowed") ||
      text.includes("default_translation") ||
      text.includes("audio_generation_allowed")) &&
    (text.includes("column") || text.includes("schema cache") || text.includes("pgrst204"))
  );
}

export function getBibleTranslationSource(translation: BibleTranslationAttribution | null | undefined) {
  return translation?.source_url ?? translation?.source ?? null;
}

export function getBibleTranslationAttribution(translation: BibleTranslationAttribution | null | undefined) {
  return translation?.attribution_text ?? translation?.attribution ?? null;
}

export async function fetchBibleTranslationMetadata(): Promise<BibleTranslationAttribution[]> {
  const viewResult = await supabase
    .from("bible_translation_metadata" as never)
    .select("*")
    .order("default_translation", { ascending: false })
    .order("name", { ascending: true });

  if (!viewResult.error) return (viewResult.data ?? []) as unknown as BibleTranslationAttribution[];
  if (!isMissingBibleTranslationMetadataColumn(viewResult.error) && !String(viewResult.error.message ?? "").toLowerCase().includes("bible_translation_metadata")) {
    throw viewResult.error;
  }

  const fallbackResult = await supabase
    .from("bible_translations" as never)
    .select("id, code, name, language_code, description, is_active, created_at")
    .order("name", { ascending: true });
  if (fallbackResult.error) throw fallbackResult.error;

  return ((fallbackResult.data ?? []) as Array<{ id: string; code: string; name: string; language_code: string; is_active?: boolean; created_at?: string }>).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    language_code: row.language_code,
    license_name: null,
    license_url: null,
    source_url: null,
    attribution_text: null,
    audio_generation_allowed: false,
    ai_processing_allowed: false,
    active: row.is_active ?? true,
    default_translation: row.code === PRIMARY_BIBLE_TRANSLATION_CODE,
    created_at: row.created_at ?? null,
    book_count: null,
    chapter_count: null,
    verse_count: null,
  }));
}

export function validateBibleTranslationMetadata(translations: BibleTranslationAttribution[]) {
  return translations.flatMap((translation) => {
    const missing: string[] = [];
    if (!translation.name) missing.push("translation name");
    if (!translation.language_code) missing.push("language");
    if (!translation.license_name) missing.push("license");
    if (!getBibleTranslationAttribution(translation)) missing.push("attribution");
    if (!getBibleTranslationSource(translation)) missing.push("source");
    return missing.length ? [{ translation, missing }] : [];
  });
}
