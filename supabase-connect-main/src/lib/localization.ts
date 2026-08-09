export type AppLanguage = "en" | "sw";

export const LANGUAGE_STORAGE_KEY = "ecclesia-language";

export const supportedAppLanguages: AppLanguage[] = ["en", "sw"];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "sw";
}

export function normalizeAppLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("sw") || normalized.endsWith("-tz")) return "sw";
  if (normalized.startsWith("en")) return "en";
  return null;
}

export function getPilotDefaultLanguage(pathname = ""): AppLanguage {
  return pathname.startsWith("/portal") ? "sw" : "en";
}

export function resolveInitialAppLanguage(input: {
  storedLanguage?: string | null;
  pathname?: string;
  browserLanguages?: readonly string[];
} = {}): AppLanguage {
  const stored = normalizeAppLanguage(input.storedLanguage);
  if (stored) return stored;

  const pilotDefault = getPilotDefaultLanguage(input.pathname ?? "");
  if (pilotDefault === "sw") return "sw";

  return "en";
}

export function setDocumentLanguage(language: AppLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

export function localeForLanguage(language: AppLanguage) {
  return language === "sw" ? "sw-TZ" : "en-US";
}

export function formatLocalizedDate(value: Date | string | number, language: AppLanguage, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeForLanguage(language), options ?? { dateStyle: "medium" }).format(new Date(value));
}

export function formatLocalizedTime(value: Date | string | number, language: AppLanguage, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeForLanguage(language), options ?? { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatLocalizedNumber(value: number, language: AppLanguage, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeForLanguage(language), options).format(value);
}

export function formatLocalizedCurrency(value: number, language: AppLanguage, currency = "TZS") {
  return formatLocalizedNumber(value, language, { style: "currency", currency, maximumFractionDigits: 0 });
}

export function getStatusLabelKey(status: string) {
  return `status.${status.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

export type LocalizedContentMatch<T> = {
  item: T | null;
  requestedLanguage: AppLanguage;
  resolvedLanguage: string | null;
  usedFallback: boolean;
};

export function preferLocalizedContent<T>(
  items: T[],
  language: AppLanguage,
  getLanguageCode: (item: T) => string | null | undefined,
): LocalizedContentMatch<T> {
  const preferred = items.find((item) => getLanguageCode(item) === language) ?? null;
  if (preferred) {
    return { item: preferred, requestedLanguage: language, resolvedLanguage: language, usedFallback: false };
  }

  const fallback = items.find((item) => getLanguageCode(item) === "en") ?? items[0] ?? null;
  return {
    item: fallback,
    requestedLanguage: language,
    resolvedLanguage: fallback ? getLanguageCode(fallback) ?? null : null,
    usedFallback: Boolean(fallback),
  };
}
