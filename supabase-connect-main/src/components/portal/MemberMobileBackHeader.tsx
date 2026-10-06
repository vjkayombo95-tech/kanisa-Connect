import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { isPrimaryMemberRoute, resolveMemberBackTarget } from "@/lib/member-mobile-navigation";
import { getMemberBackTitle, getMemberBackTitleKey } from "@/lib/member-service-registry";
import { translateSystemLabel } from "@/lib/localization";

function getMemberPageTitle(pathname: string, t: ReturnType<typeof useTranslation>["t"]) {
  if (/^\/(?:portal|member)\/contribution-receipt\/[^/]+$/.test(pathname)) return t("member_services.contribution_history.receipt_title");
  if (/^\/(?:portal|member)\/bible\/[^/]+\/chapter\//.test(pathname)) return t("member_services.bible.chapter_title");
  if (/^\/(?:portal|member)\/bible\/[^/]+$/.test(pathname)) return t("member_services.bible.back_title");
  if (/^\/(?:portal|member)\/library\/[^/]+$/.test(pathname)) return t("member_services.library.detail_title");
  if (/^\/(?:portal|member)\/live\/[^/]+$/.test(pathname)) return t("member_services.livestream.back_title");
  if (/^\/(?:portal|member)\/ministries\/[^/]+$/.test(pathname)) return t("member_services.ministries.back_title");
  return translateSystemLabel(t, getMemberBackTitleKey(pathname), getMemberBackTitle(pathname) ?? t("member_services.services.label"));
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
