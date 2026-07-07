import type { MemberHomeData } from "./types";
import { formatLocalizedDate, type AppLanguage } from "@/lib/localization";

export const emptyMemberHome = (name: string): MemberHomeData => ({
  memberId: null,
  memberName: name,
  churchName: null,
  churchLogoUrl: null,
  churchAddress: null,
  churchPhone: null,
  churchEmail: null,
  churchOfficeHours: null,
  churchEmergencyContact: null,
  churchLivestreamUrl: null,
  churchSocialLinks: [],
  totalPaid: 0,
  totalThisMonth: 0,
  pendingAmount: 0,
  lastPayment: null,
  latestAnnouncement: null,
});

export function formatDate(value: string | null, language: AppLanguage = "sw") {
  if (!value) return "Hakuna bado";

  return formatLocalizedDate(value, language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMassTime(value: string | null) {
  if (!value) return "";
  const [hours = "0", minutes = "0"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-TZ", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isDeadlinePassed(value: string | null) {
  return value ? new Date(value).getTime() < Date.now() : false;
}

export function truncatePreview(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}
