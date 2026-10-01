import type { StaffMobileConfig, StaffService } from "@/lib/staff-mobile-registry";
import type { StaffMobileWorkspace } from "@/lib/staff-mobile-role";

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

type Translator = (key: string, options?: Record<string, unknown>) => string;

export function translateSystemLabel(t: Translator, key: string | undefined, fallback = "") {
  if (!key) return fallback;
  const translated = t(key, { defaultValue: fallback });
  return translated === key ? fallback : translated;
}

export function translateStaffWorkspaceLabel(
  t: Translator,
  workspace: StaffMobileWorkspace | "community" | null | undefined,
) {
  if (!workspace) return "";

  const fallback = {
    admin: "Uendeshaji wa parokia",
    community: "Uongozi wa Jumuiya",
    finance: "Usimamizi wa fedha",
    member: "Mwanachama",
    pastoral: "Huduma ya kichungaji",
    super_admin: "Usimamizi wa mfumo",
  }[workspace] ?? "";

  return translateSystemLabel(t, `staff_workspaces.${workspace}`, fallback);
}

export function translateStaffServiceLabel(
  t: Translator,
  service: Pick<StaffService, "label" | "labelKey">,
) {
  return translateSystemLabel(t, service.labelKey, service.label);
}

export function translateStaffServiceGroup(
  t: Translator,
  service: Pick<StaffService, "group" | "groupKey">,
) {
  return translateSystemLabel(t, service.groupKey, service.group);
}

export function translateStaffWorkLabel(
  t: Translator,
  config: Pick<StaffMobileConfig, "workLabel" | "workLabelKey">,
) {
  return translateSystemLabel(t, config.workLabelKey, config.workLabel);
}

export const SYSTEM_ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "role_labels.admin",
  church_admin: "role_labels.church_admin",
  finance: "role_labels.finance",
  member: "role_labels.member",
  pastor: "role_labels.pastor",
  pastoral: "role_labels.pastoral",
  priest: "role_labels.priest",
  secretary: "role_labels.secretary",
  staff: "role_labels.staff",
  super_admin: "role_labels.super_admin",
  treasurer: "role_labels.treasurer",
};

export function translateRoleLabel(
  t: Translator,
  role: string | null | undefined,
) {
  if (!role) return "";

  return translateSystemLabel(
    t,
    SYSTEM_ROLE_LABEL_KEYS[role] ?? `role_labels.${role}`,
    role.replace(/_/g, " "),
  );
}

const DATE_TIME_ZONE = "Africa/Dar_es_Salaam";

export const APP_DATE_LOCALES: Record<AppLanguage, string> = {
  en: "en-TZ",
  sw: "sw-TZ",
};

export function getAppDateLocale(language: string | undefined) {
  return APP_DATE_LOCALES[normalizeAppLanguage(language) ?? "en"];
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
}

export function formatAppDate(
  value: Date | string | number | null | undefined,
  language: string | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  if (value == null || value === "") return "";

  const dateOnly =
    typeof value === "string" ? parseDateOnly(value) : null;

  const date = dateOnly ?? new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(
    getAppDateLocale(language),
    dateOnly
      ? { ...options, timeZone: "UTC" }
      : { timeZone: DATE_TIME_ZONE, ...options },
  ).format(date);
}

export function translateChurchAdminRouteTitle(
  t: Translator,
  pathname: string,
) {
  const normalizedPath = pathname.replace(/\/$/, "") || "/church-admin";

  const routes = [
    { path: "/church-admin", key: "church_admin_dashboard.navigation.home", fallback: "Dashboard" },
    { path: "/church-admin/members", key: "church_admin_dashboard.navigation.members", fallback: "Members" },
    { path: "/church-admin/announcements", key: "church_admin_dashboard.navigation.announcements", fallback: "Announcements" },
    { path: "/church-admin/contributions", key: "church_admin_dashboard.navigation.contributions", fallback: "Contributions" },
    { path: "/church-admin/mass-intentions", key: "church_admin_dashboard.navigation.mass_intentions", fallback: "Mass Intentions" },
    { path: "/church-admin/mass-timetable", key: "church_admin_dashboard.navigation.mass_timetable", fallback: "Mass Timetable" },
  ];

  const route = routes
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find(({ path }) =>
      normalizedPath === path || normalizedPath.startsWith(`${path}/`)
    );

  return translateSystemLabel(
    t,
    route?.key,
    route?.fallback ?? "Dashboard",
  );
}
