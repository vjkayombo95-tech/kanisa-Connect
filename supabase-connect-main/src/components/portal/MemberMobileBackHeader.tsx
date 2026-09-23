import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";
import { getMemberBackTitle, getMemberBackTitleKey } from "@/lib/member-service-registry";
import { translateSystemLabel } from "@/lib/localization";

const titleByRoute: Record<string, string> = {
  "/portal/dashboard": "Historia Yangu",
  "/portal/give": "Michango",
  "/portal/contribution-history": "Historia ya Michango",
  "/portal/mass-intentions": "Nia za Misa",
  "/portal/announcements": "Matangazo",
  "/portal/prayer-requests": "Maombi",
  "/portal/channels": "Njia za Mawasiliano",
  "/portal/bible": "Biblia",
  "/portal/library": "Watakatifu",
  "/member/library": "Watakatifu",
  "/portal/liturgical-calendar": "Kalenda ya Liturujia",
  "/portal/daily-readings": "Masomo ya Leo",
  "/portal/today": "Leo",
  "/portal/my-parish": "Parokia Yangu",
  "/portal/jumuiya": "Jumuiya Yangu",
  "/portal/ministries": "Huduma za Parokia",
};

const titleKeyByRoute: Record<string, string> = {
  "/portal/dashboard": "member_services.dashboard.back_title",
  "/portal/give": "member_services.give.back_title",
  "/portal/contribution-history": "member_services.contribution_history.back_title",
  "/portal/mass-intentions": "member_services.mass_intentions.back_title",
  "/portal/announcements": "member_services.announcements.back_title",
  "/portal/prayer-requests": "member_services.prayer_requests.back_title",
  "/portal/channels": "member_services.channels.back_title",
  "/portal/bible": "member_services.bible.back_title",
  "/portal/library": "member_services.library.back_title",
  "/member/library": "member_services.library.back_title",
  "/portal/liturgical-calendar": "member_services.liturgical_calendar.back_title",
  "/portal/daily-readings": "member_services.daily_readings.back_title",
  "/portal/today": "member_services.today.back_title",
  "/portal/my-parish": "member_services.my_parish.back_title",
  "/portal/jumuiya": "member_services.jumuiya.back_title",
  "/portal/ministries": "member_services.ministries.back_title",
};

function getMemberPageTitle(pathname: string, t: ReturnType<typeof useTranslation>["t"]) {
  if (/^\/(?:portal|member)\/contribution-receipt\/[^/]+$/.test(pathname)) return t("member_services.contribution_history.receipt_title");
  if (/^\/(?:portal|member)\/bible\/[^/]+\/chapter\//.test(pathname)) return t("member_services.bible.chapter_title");
  if (/^\/(?:portal|member)\/bible\/[^/]+$/.test(pathname)) return t("member_services.bible.back_title");
  if (/^\/(?:portal|member)\/library\/[^/]+$/.test(pathname)) return t("member_services.library.detail_title");
  if (/^\/(?:portal|member)\/live\/[^/]+$/.test(pathname)) return t("member_services.livestream.back_title");
  if (/^\/(?:portal|member)\/ministries\/[^/]+$/.test(pathname)) return t("member_services.ministries.back_title");
  return translateSystemLabel(t, getMemberBackTitleKey(pathname) ?? titleKeyByRoute[pathname], getMemberBackTitle(pathname) ?? titleByRoute[pathname] ?? t("member_services.services.label"));
}

export function MemberMobileBackHeader() {
  const { t } = useTranslation();
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
  const title = getMemberPageTitle(location.pathname, t);

  return (
    <header className="container mx-auto px-4 pt-4 lg:hidden" data-testid="member-mobile-back-header">
      <button
        type="button"
        onClick={() => navigate(target)}
        aria-label={t("member_mobile.back_from", { title })}
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
