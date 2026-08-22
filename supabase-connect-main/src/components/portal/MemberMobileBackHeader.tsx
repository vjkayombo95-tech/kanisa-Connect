import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";

const titleByRoute: Record<string, string> = {
  "/portal/dashboard": "Historia Yangu",
  "/portal/give": "Michango",
  "/portal/contribution-history": "Historia ya Michango",
  "/portal/mass-intentions": "Nia za Misa",
  "/portal/announcements": "Matangazo",
  "/portal/prayer-requests": "Maombi",
  "/portal/channels": "Jumuiya",
  "/portal/bible": "Biblia",
  "/portal/library": "Watakatifu",
  "/member/library": "Watakatifu",
  "/portal/liturgical-calendar": "Kalenda ya Liturujia",
  "/portal/daily-readings": "Masomo ya Leo",
  "/portal/ministries": "Huduma za Parokia",
};

function getMemberPageTitle(pathname: string) {
  if (/^\/(?:portal|member)\/contribution-receipt\/[^/]+$/.test(pathname)) return "Risiti ya Mchango";
  if (/^\/(?:portal|member)\/bible\/[^/]+\/chapter\//.test(pathname)) return "Sura ya Biblia";
  if (/^\/(?:portal|member)\/bible\/[^/]+$/.test(pathname)) return "Biblia";
  if (/^\/(?:portal|member)\/library\/[^/]+$/.test(pathname)) return "Mtakatifu";
  if (/^\/(?:portal|member)\/live\/[^/]+$/.test(pathname)) return "Misa Mubashara";
  if (/^\/(?:portal|member)\/ministries\/[^/]+$/.test(pathname)) return "Huduma za Parokia";
  return titleByRoute[pathname] ?? "Huduma";
}

export function MemberMobileBackHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  if (isPrimaryMemberRoute(location.pathname)) return null;

  const stateFrom = (location.state as { from?: unknown } | null)?.from;
  const target = resolveMemberBackTarget(
    location.pathname,
    stateFrom,
    typeof document !== "undefined" ? document.referrer : undefined,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );
  const title = getMemberPageTitle(location.pathname);

  return (
    <header className="container mx-auto px-4 pt-4 lg:hidden" data-testid="member-mobile-back-header">
      <button
        type="button"
        onClick={() => navigate(target)}
        aria-label={`Rudi kutoka ${title}`}
        className="group flex min-h-12 min-w-0 items-center gap-2 rounded-2xl pr-3 text-left text-foreground outline-none transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary">
          <ChevronLeft className="h-6 w-6 stroke-[1.8] transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</span>
      </button>
    </header>
  );
}
