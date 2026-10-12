export const DEFAULT_LOGIN_REDIRECT = "/portal";

const containsControlCharacters = (value: string) => Array.from(value).some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127; });
const ENCODED_UNSAFE_CHARACTER_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i;

const allowedRedirectRoutes = [
  "/",
  "/portal",
  "/member",
  "/community",
  "/church-admin",
  "/diocese",
  "/super-admin",
  "/onboarding",
  "/invite",
  "/register",
  "/join",
  "/join-church",
  "/scan-qr",
  "/give",
  "/pay",
  "/forgot-password",
];

type RedirectOptions = {
  fallback?: string;
  origin?: string;
};

function getCurrentOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return "https://kanisa-connect.invalid";
}

function isAllowedApplicationRoute(pathname: string) {
  return allowedRedirectRoutes.some((route) =>
    pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}

export function normalizeLoginRedirect(
  value: string | null | undefined,
  options: RedirectOptions = {},
) {
  const fallback = options.fallback ?? DEFAULT_LOGIN_REDIRECT;
  const origin = options.origin ?? getCurrentOrigin();

  if (!value || value !== value.trim()) return fallback;
  if (containsControlCharacters(value)) return fallback;
  if (value.includes("\\") || ENCODED_UNSAFE_CHARACTER_PATTERN.test(value)) return fallback;
  if (/%25(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(value)) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("/../") || value.includes("/./") || value.endsWith("/..") || value.endsWith("/.")) return fallback;

  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return fallback;
  }

  if (url.origin !== origin) return fallback;
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
  if (!isAllowedApplicationRoute(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
