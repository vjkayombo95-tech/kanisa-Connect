import DOMPurify from "dompurify";

const RICH_TEXT_TAG_PATTERN = /<\/?(?:p|br|h2|h3|strong|b|em|i|u|ul|ol|li|blockquote|a|hr)(?:\s|>|\/)/i;
const ALLOWED_TAGS = ["p", "br", "h2", "h3", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "hr"];
const ALLOWED_ATTRIBUTES = ["href", "target", "rel", "style"];
const BLOCK_TAGS = "p,h2,h3,li,blockquote,hr";

export function isSafeAnnouncementUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAnnouncementRichText(value: string | null | undefined) {
  return RICH_TEXT_TAG_PATTERN.test(value ?? "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeAnnouncementHtml(value: string | null | undefined) {
  const source = value ?? "";
  if (!source) return "";

  const sanitized = DOMPurify.sanitize(source, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
  });

  const document = new DOMParser().parseFromString(`<body>${sanitized}</body>`, "text/html");

  document.body.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const alignment = element.style.textAlign;
    if (["left", "center", "right"].includes(alignment)) {
      element.setAttribute("style", `text-align: ${alignment}`);
    } else {
      element.removeAttribute("style");
    }
  });

  document.body.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    if (!isSafeAnnouncementUrl(link.href)) {
      link.replaceWith(...Array.from(link.childNodes));
      return;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  return document.body.innerHTML.trim();
}

export function normalizeAnnouncementContent(value: string | null | undefined) {
  const source = value ?? "";
  if (!source.trim()) return "";
  if (isAnnouncementRichText(source)) return sanitizeAnnouncementHtml(source);

  return source
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function announcementHtmlToPlainText(value: string | null | undefined) {
  const source = value ?? "";
  if (!source) return "";
  if (!isAnnouncementRichText(source)) return source.replace(/\r\n/g, "\n").trim();

  const document = new DOMParser().parseFromString(`<body>${sanitizeAnnouncementHtml(source)}</body>`, "text/html");
  document.body.querySelectorAll("br").forEach((node) => node.replaceWith(document.createTextNode("\n")));
  document.body.querySelectorAll("li").forEach((node) => node.prepend(document.createTextNode("\u2022 ")));
  document.body.querySelectorAll(BLOCK_TAGS).forEach((node) => node.append(document.createTextNode("\n")));

  return (document.body.textContent ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function isRichTextEmpty(value: string | null | undefined) {
  return announcementHtmlToPlainText(value).length === 0;
}

export function getAnnouncementContentStats(value: string | null | undefined) {
  const plainText = announcementHtmlToPlainText(value);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const characters = plainText.length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));
  return { words, characters, readingMinutes };
}
