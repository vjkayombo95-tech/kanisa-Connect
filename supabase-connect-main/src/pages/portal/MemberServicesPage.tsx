import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Church,
  HandCoins,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  Radio,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { Input } from "@/components/ui/input";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { getYouTubeEmbedUrl, presentation } from "@/lib/church-livestreams";
import { translateMemberServiceDescription, translateMemberServiceLabel, translateSystemLabel } from "@/lib/localization";
import { memberServiceRegistry, type MemberServiceDefinition, type MemberServiceIconKey } from "@/lib/member-service-registry";

const icons: Record<MemberServiceIconKey, typeof Church> = {
  book: BookOpen,
  calendar: CalendarDays,
  church: Church,
  giving: HandCoins,
  intention: HeartHandshake,
  announcement: Megaphone,
  message: MessageCircle,
  prayer: Sparkles,
  radio: Radio,
  users: Users,
};

type PresentationGroupId = "parish-services" | "spiritual" | "media" | "account-other";

const OMITTED_ZAIDI_SERVICE_IDS = new Set(["home", "services", "today", "my-parish"]);

const presentationGroups: Array<{ id: PresentationGroupId; labelKey: string; fallbackLabel: string; descriptionKey: string; fallbackDescription: string }> = [
  { id: "parish-services", labelKey: "member_services_page.groups.parish_services.label", fallbackLabel: "Huduma za Parokia", descriptionKey: "member_services_page.groups.parish_services.description", fallbackDescription: "Huduma za kushiriki na kufuatilia maisha ya parokia." },
  { id: "spiritual", labelKey: "member_services_page.groups.spiritual.label", fallbackLabel: "Kiroho", descriptionKey: "member_services_page.groups.spiritual.description", fallbackDescription: "Maeneo ya sala, Neno la Mungu, na malezi ya imani." },
  { id: "media", labelKey: "member_services_page.groups.media.label", fallbackLabel: "Media", descriptionKey: "member_services_page.groups.media.description", fallbackDescription: "Sikiliza au tazama huduma zinazopatikana sasa." },
  { id: "account-other", labelKey: "member_services_page.groups.account_other.label", fallbackLabel: "Akaunti / Nyingine", descriptionKey: "member_services_page.groups.account_other.description", fallbackDescription: "Historia, arifa, na zana nyingine salama." },
];

const servicePresentationGroup: Record<string, PresentationGroupId> = {
  give: "parish-services",
  "mass-intentions": "parish-services",
  calendar: "parish-services",
  events: "parish-services",
  announcements: "parish-services",
  channels: "parish-services",
  jumuiya: "parish-services",
  ministries: "parish-services",
  "prayer-requests": "parish-services",
  bible: "spiritual",
  "daily-readings": "spiritual",
  prayers: "spiritual",
  reflections: "spiritual",
  sermons: "spiritual",
  "liturgical-calendar": "spiritual",
  library: "spiritual",
  radio: "media",
  livestream: "media",
  "contribution-history": "account-other",
  pledges: "account-other",
  notifications: "account-other",
  "kanisa-ai": "account-other",
};

function normalizeSearch(value: string, language: string) {
  return value.toLocaleLowerCase(language === "sw" ? "sw" : "en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getPresentationGroupId(service: MemberServiceDefinition): PresentationGroupId {
  return servicePresentationGroup[service.id] ?? "account-other";
}

function ServiceRows({ items, t }: { items: MemberServiceDefinition[]; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-border/65 bg-card/75 shadow-sm">
      {items.map((item) => {
        const Icon = icons[item.iconKey];
        const label = translateMemberServiceLabel(t, item);
        const description = translateMemberServiceDescription(t, item);

        return (
          <AppLink
            key={item.id}
            to={item.path}
            aria-label={t("member_services_page.open_service", { label })}
            className="group flex min-h-[68px] items-center gap-3 border-b border-border/55 px-3.5 py-3 text-left outline-none transition-colors last:border-0 hover:bg-primary/[0.055] focus-visible:bg-primary/[0.075] focus-visible:ring-2 focus-visible:ring-primary/50 sm:gap-4 sm:px-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground sm:text-base">{label}</span>
              <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground sm:text-sm">{description}</span>
            </span>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" aria-hidden="true" />
          </AppLink>
        );
      })}
    </div>
  );
}

export default function MemberServicesPage() {
  const { t, i18n } = useTranslation();
  const { getFeatureState, isFeatureExplicitlyEnabledForChurch } = useFeatureAccess();
  const livestream = useChurchLivestream();
  const [search, setSearch] = useState("");
  const livestreamService = useMemo<MemberServiceDefinition | null>(() => {
    const stream = livestream.data;
    if (!livestream.featureEnabled || livestream.featureLoading || livestream.isLoading || livestream.error || !stream) return null;
    if (!livestream.churchId || stream.churchId !== livestream.churchId || !presentation(stream) || !getYouTubeEmbedUrl(stream)) return null;
    const base = memberServiceRegistry.find((item) => item.id === "livestream")!;
    return {
      ...base,
      path: `/portal/live/${stream.id}`,
      showInServices: true,
      description: stream.status === "live" ? "Tazama Misa moja kwa moja" : "Misa inaanza hivi karibuni",
      descriptionKey: stream.status === "live" ? "member_services_page.livestream.live_description" : "member_services_page.livestream.upcoming_description",
    };
  }, [livestream.churchId, livestream.data, livestream.error, livestream.featureEnabled, livestream.featureLoading, livestream.isLoading]);

  const visibleServices = useMemo(
    () =>
      [...memberServiceRegistry.filter((item) => item.showInServices), ...(livestreamService ? [livestreamService] : [])]
        .filter((item) => !OMITTED_ZAIDI_SERVICE_IDS.has(item.id))
        .filter((item) => {
          if (!item.ordinaryMemberAllowed) return false;
          if (!item.featureKey) return true;
          if (item.requiresExplicitChurchEnable) return isFeatureExplicitlyEnabledForChurch(item.featureKey);
          const state = getFeatureState(item.featureKey);
          return (!item.requiresExistingFeature || state.exists) && state.visible;
        }),
    [getFeatureState, isFeatureExplicitlyEnabledForChurch, livestreamService],
  );
  const query = normalizeSearch(search, i18n.language);
  const filtered = query
    ? visibleServices.filter((item) =>
        normalizeSearch(`${translateMemberServiceLabel(t, item)} ${translateMemberServiceDescription(t, item)}`, i18n.language).includes(query),
      )
    : visibleServices;
  const groupedServices = useMemo(
    () =>
      presentationGroups
        .map((group) => ({
          ...group,
          items: filtered.filter((item) => getPresentationGroupId(item) === group.id),
        }))
        .filter((group) => group.items.length > 0),
    [filtered],
  );

  return (
    <main
      className="mx-auto w-full max-w-4xl space-y-5 overflow-x-hidden px-4 py-5 pb-28 lg:px-8 lg:py-7 lg:pb-10"
      data-testid="member-services-page"
    >
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kanisa Connect</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{t("member_services_page.title")}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("member_services_page.subtitle")}
          </p>
        </div>
      </header>

      <label className="relative block max-w-xl">
        <span className="sr-only">{t("member_services_page.search_label")}</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("member_services_page.search_placeholder")}
          aria-label={t("member_services_page.search_label")}
          className="h-11 rounded-2xl border-border/70 bg-card/75 pl-11 text-sm shadow-sm"
        />
      </label>

      <div className="space-y-5">
        {query ? (
          <section aria-labelledby="services-search-results">
            <h2 id="services-search-results" className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              {t("member_services_page.search_results")}
            </h2>
            {filtered.length ? (
              <ServiceRows items={filtered} t={t} />
            ) : (
              <div className="rounded-[22px] border border-border/65 bg-card/70 px-5 py-8 text-center text-sm text-muted-foreground">
                {t("member_services_page.no_results")}
              </div>
            )}
          </section>
        ) : (
          groupedServices.map((group) => (
            <section key={group.id} aria-labelledby={`services-${group.id}`} className="space-y-2">
              <div className="px-1">
                <h2 id={`services-${group.id}`} className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {translateSystemLabel(t, group.labelKey, group.fallbackLabel)}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground/80">{translateSystemLabel(t, group.descriptionKey, group.fallbackDescription)}</p>
              </div>
              <ServiceRows items={group.items} t={t} />
            </section>
          ))
        )}
      </div>
    </main>
  );
}
