function appOrigin() {
  return typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "https://kanisaniconnect.netlify.app";
}

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function shorten(value: string | null | undefined, maxLength = 180) {
  const text = clean(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function appLink(path = "/portal") {
  return `${appOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppShare(message: string): void {
  if (typeof window === "undefined") return;
  window.open(buildWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
}

export function buildCommunityInviteMessage({
  communityName,
  churchName,
  inviteLink,
  message,
}: {
  communityName: string;
  churchName?: string | null;
  inviteLink?: string | null;
  message?: string | null;
}) {
  const link = clean(inviteLink) || appLink("/portal");
  const note = shorten(message, 220) || "Tafadhali angalia tangazo jipya la kanisa kupitia Kanisani Connect:";

  return [
    `Habari wana Jumuiya ya ${clean(communityName) || "kanisa"}.`,
    clean(churchName) ? `Kutoka ${clean(churchName)}.` : null,
    note,
    link,
  ].filter(Boolean).join("\n\n");
}

export function buildAnnouncementShareMessage({
  churchName,
  title,
  body,
  link,
}: {
  churchName?: string | null;
  title: string;
  body: string;
  link?: string | null;
}) {
  return [
    clean(churchName) ? `Tangazo kutoka ${clean(churchName)}` : "Tangazo la Kanisa",
    clean(title),
    shorten(announcementHtmlToPlainText(body)),
    clean(link) || appLink("/portal/announcements"),
  ].filter(Boolean).join("\n\n");
}

export function buildEventShareMessage({
  churchName,
  title,
  dateTime,
  location,
  link,
}: {
  churchName?: string | null;
  title: string;
  dateTime?: string | null;
  location?: string | null;
  link?: string | null;
}) {
  return [
    `Tukio: ${clean(title)}`,
    clean(churchName) ? `Kanisa: ${clean(churchName)}` : null,
    clean(dateTime) ? `Muda: ${clean(dateTime)}` : null,
    clean(location) ? `Mahali: ${clean(location)}` : null,
    clean(link) || appLink("/portal/events"),
  ].filter(Boolean).join("\n\n");
}

export function buildContributionShareMessage({
  churchName,
  givingLink,
}: {
  churchName?: string | null;
  givingLink: string;
}) {
  return `Changia ${clean(churchName) || "kanisa"} kupitia Kanisani Connect:\n${givingLink}`;
}

export function buildRenderedChurchMessageShare(renderedMessage: string) {
  return clean(renderedMessage);
}
import { announcementHtmlToPlainText } from "@/lib/announcement-content";
