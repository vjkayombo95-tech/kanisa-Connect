const PRIMARY_MEMBER_ROUTES = new Set(["/portal", "/portal/services", "/member", "/member/services"]);

export function isPrimaryMemberRoute(pathname: string) {
  return PRIMARY_MEMBER_ROUTES.has(pathname.replace(/\/$/, "") || "/");
}

export function getMemberBackFallback(pathname: string) {
  const bibleChapter = pathname.match(/^\/(?:portal|member)\/bible\/([^/]+)\/chapter\//);
  if (bibleChapter) return `/portal/bible/${bibleChapter[1]}`;
  if (/^\/(?:portal|member)\/bible\/[^/]+$/.test(pathname)) return "/portal/bible";
  if (/^\/(?:portal|member)\/library\/[^/]+$/.test(pathname)) return "/member/library";
  if (/^\/(?:portal|member)\/contribution-receipt\/[^/]+$/.test(pathname)) return "/portal/contribution-history";
  return "/portal/services";
}

export function resolveMemberBackTarget(pathname: string, stateFrom?: unknown, referrer?: string, origin?: string) {
  if (
    typeof stateFrom === "string" &&
    (stateFrom.startsWith("/portal") || stateFrom.startsWith("/member")) &&
    stateFrom !== pathname
  ) {
    return stateFrom;
  }

  const logicalParent = getMemberBackFallback(pathname);
  if (logicalParent !== "/portal/services") return logicalParent;

  if (referrer && origin) {
    try {
      const previous = new URL(referrer);
      const previousPath = `${previous.pathname}${previous.search}`;
      const memberRoute = previous.pathname.startsWith("/portal") || previous.pathname.startsWith("/member");
      if (previous.origin === origin && memberRoute && previousPath !== pathname) return previousPath;
    } catch {
      // Invalid referrers fall through to the safe services route.
    }
  }

  return logicalParent;
}
