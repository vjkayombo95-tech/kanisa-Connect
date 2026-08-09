import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";

const titleByRoute: Record<string, string> = {
  "/portal/give": "Michango",
  "/portal/contribution-history": "Michango",
  "/portal/mass-intentions": "Nia ya Misa",
  "/portal/calendar": "Ratiba ya Misa",
  "/portal/announcements": "Matangazo",
  "/portal/prayer-requests": "Maombi",
  "/portal/today": "Leo Kanisani",
  "/portal/channels": "Jumuiya",
  "/portal/my-parish": "Parokia Yangu",
  "/portal/bible": "Biblia",
  "/portal/prayers": "Sala",
  "/portal/library": "Watakatifu",
  "/portal/liturgical-calendar": "Kalenda ya Liturujia",
  "/portal/daily-readings": "Masomo ya Leo",
  "/portal/radio": "Radio Live",
};

function getMemberPageTitle(pathname: string, fallbackTitle: string) {
  if (/^\/portal\/live\/[^/]+$/.test(pathname)) return "Misa Moja kwa Moja";
  if (pathname.startsWith("/portal/contribution-receipt/")) return "Risiti ya Mchango";
  if (/^\/portal\/bible\/[^/]+\/chapter\//.test(pathname)) return "Sura ya Biblia";
  if (/^\/portal\/bible\/[^/]+$/.test(pathname)) return "Biblia";
  if (/^\/portal\/prayers\/[^/]+$/.test(pathname)) return "Sala";
  if (/^\/portal\/(library|saints)\/[^/]+$/.test(pathname)) return "Mtakatifu";
  return titleByRoute[pathname] ?? fallbackTitle;
}

export function MemberMobileBackHeader({ title }: { title: string }) {
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
  const pageTitle = getMemberPageTitle(location.pathname, title);

  return (
    <header className="mb-4 flex min-w-0 items-center lg:hidden" data-testid="member-mobile-back-header">
      <button type="button" onClick={() => navigate(target)} aria-label={`Rudi kutoka ${pageTitle}`} className="group flex min-h-12 min-w-0 items-center gap-2 rounded-2xl pr-3 text-left text-foreground outline-none transition-[color,transform] duration-200 motion-reduce:transition-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:active:scale-100">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"><ChevronLeft className="h-6 w-6 stroke-[1.8] transition-transform duration-200 motion-reduce:transition-none group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></span>
        <span className="min-w-0 truncate text-lg font-semibold tracking-tight">{pageTitle}</span>
      </button>
    </header>
  );
}
