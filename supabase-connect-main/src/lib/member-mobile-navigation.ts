const PRIMARY_MEMBER_ROUTES = new Set(["/portal", "/portal/kanisa-ai", "/portal/services"]);

export function isPrimaryMemberRoute(pathname: string) {
  return PRIMARY_MEMBER_ROUTES.has(pathname.replace(/\/$/, "") || "/");
}

export function getMemberBackFallback(pathname: string) {
  if (pathname === "/portal/radio") return "/portal";
  if (/^\/portal\/live\/[^/]+$/.test(pathname)) return "/portal";
  if (pathname.startsWith("/portal/contribution-receipt/")) return "/portal/contribution-history";
  const bibleChapter = pathname.match(/^\/portal\/bible\/([^/]+)\/chapter\//);
  if (bibleChapter) return `/portal/bible/${bibleChapter[1]}`;
  if (/^\/portal\/bible\/[^/]+$/.test(pathname)) return "/portal/bible";
  if (/^\/portal\/prayers\/[^/]+$/.test(pathname)) return "/portal/prayers";
  if (/^\/portal\/reflections\/[^/]+$/.test(pathname)) return "/portal/reflections";
  if (/^\/portal\/ministries\/[^/]+$/.test(pathname)) return "/portal/ministries";
  if (/^\/portal\/(library|saints)\/[^/]+$/.test(pathname)) return "/portal/library";
  return "/portal/services";
}

export function resolveMemberBackTarget(pathname: string, stateFrom?: unknown, referrer?: string, origin?: string) {
  if (typeof stateFrom === "string" && stateFrom.startsWith("/portal") && stateFrom !== pathname) return stateFrom;
  const logicalParent = getMemberBackFallback(pathname);
  if (logicalParent !== "/portal/services") return logicalParent;
  if (referrer && origin) {
    try {
      const previous = new URL(referrer);
      const previousPath = `${previous.pathname}${previous.search}`;
      if (previous.origin === origin && previous.pathname.startsWith("/portal") && previousPath !== pathname) return previousPath;
    } catch {
      // Invalid referrers are ignored in favor of the safe route fallback.
    }
  }
  return logicalParent;
}
