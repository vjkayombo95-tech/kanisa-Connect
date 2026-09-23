import type { AppLanguage } from "@/i18n";
import type { MemberServiceDefinition, MemberServiceGroup } from "@/lib/member-service-registry";
import type { StaffMobileConfig, StaffService } from "@/lib/staff-mobile-registry";
import type { StaffMobileWorkspace } from "@/lib/staff-mobile-role";

type Translator = (key: string, options?: Record<string, unknown>) => string;

const DATE_TIME_ZONE = "Africa/Dar_es_Salaam";

export const APP_DATE_LOCALES: Record<AppLanguage, string> = {
  en: "en-TZ",
  sw: "sw-TZ",
};

export const SYSTEM_STATUS_LABEL_KEYS: Record<string, string> = {
  active: "statuses.active",
  approved: "statuses.approved",
  cancelled: "statuses.cancelled",
  changes_requested: "statuses.changes_requested",
  completed: "statuses.completed",
  converted: "statuses.converted",
  draft: "statuses.draft",
  inactive: "statuses.inactive",
  pending: "statuses.pending",
  rejected: "statuses.rejected",
  rescheduled: "statuses.rescheduled",
  scheduled: "statuses.scheduled",
  sent: "statuses.sent",
  submitted: "statuses.submitted",
  suspended: "statuses.suspended",
  under_review: "statuses.under_review",
};

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

export function normalizeAppLanguage(language: string | undefined): AppLanguage {
  return language === "sw" ? "sw" : "en";
}

export function getAppDateLocale(language: string | undefined) {
  return APP_DATE_LOCALES[normalizeAppLanguage(language)];
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

export function formatAppDate(
  value: Date | string | number | null | undefined,
  language: string | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  if (value == null || value === "") return "";
  const dateOnly = typeof value === "string" ? parseDateOnly(value) : null;
  const date = dateOnly ?? new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(
    getAppDateLocale(language),
    dateOnly ? { ...options, timeZone: "UTC" } : { timeZone: DATE_TIME_ZONE, ...options },
  ).format(date);
}

export function translateSystemLabel(t: Translator, key: string | undefined, fallback = "") {
  if (!key) return fallback;
  const translated = t(key, { defaultValue: fallback });
  return translated === key ? fallback : translated;
}

export function translateStatusLabel(t: Translator, status: string | null | undefined) {
  if (!status) return "";
  return translateSystemLabel(t, SYSTEM_STATUS_LABEL_KEYS[status] ?? `statuses.${status}`, status.replace(/_/g, " "));
}

export function translateRoleLabel(t: Translator, role: string | null | undefined) {
  if (!role) return "";
  return translateSystemLabel(t, SYSTEM_ROLE_LABEL_KEYS[role] ?? `role_labels.${role}`, role.replace(/_/g, " "));
}

export function translateStaffWorkspaceLabel(t: Translator, workspace: StaffMobileWorkspace | "community" | null | undefined) {
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

export function translateStaffServiceLabel(t: Translator, service: Pick<StaffService, "label" | "labelKey">) {
  return translateSystemLabel(t, service.labelKey, service.label);
}

export function translateStaffServiceGroup(t: Translator, service: Pick<StaffService, "group" | "groupKey">) {
  return translateSystemLabel(t, service.groupKey, service.group);
}

export function translateStaffWorkLabel(t: Translator, config: Pick<StaffMobileConfig, "workLabel" | "workLabelKey">) {
  return translateSystemLabel(t, config.workLabelKey, config.workLabel);
}

export function translateMemberServiceLabel(t: Translator, service: Pick<MemberServiceDefinition, "label" | "labelKey">) {
  return translateSystemLabel(t, service.labelKey, service.label);
}

export function translateMemberServiceDescription(t: Translator, service: Pick<MemberServiceDefinition, "description" | "descriptionKey">) {
  return translateSystemLabel(t, service.descriptionKey, service.description);
}

export function translateMemberServiceGroup(t: Translator, group: { id: MemberServiceGroup; label: string; labelKey?: string }) {
  return translateSystemLabel(t, group.labelKey, group.label);
}

export function translateMemberBackTitle(t: Translator, service: Pick<MemberServiceDefinition, "backTitle" | "backTitleKey" | "label" | "labelKey">) {
  return translateSystemLabel(t, service.backTitleKey ?? service.labelKey, service.backTitle ?? service.label);
}
