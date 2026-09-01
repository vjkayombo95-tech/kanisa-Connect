import { useMemo, useState } from "react";
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

const presentationGroups: Array<{ id: PresentationGroupId; label: string; description: string }> = [
  { id: "parish-services", label: "Huduma za Parokia", description: "Huduma za kushiriki na kufuatilia maisha ya parokia." },
  { id: "spiritual", label: "Kiroho", description: "Maeneo ya sala, Neno la Mungu, na malezi ya imani." },
  { id: "media", label: "Media", description: "Sikiliza au tazama huduma zinazopatikana sasa." },
  { id: "account-other", label: "Akaunti / Nyingine", description: "Historia, arifa, na zana nyingine salama." },
];

const servicePresentationGroup: Record<string, PresentationGroupId> = {
  give: "parish-services",
  "mass-intentions": "parish-services",
  calendar: "parish-services",
  events: "parish-services",
  announcements: "parish-services",
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

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("sw").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getPresentationGroupId(service: MemberServiceDefinition): PresentationGroupId {
  return servicePresentationGroup[service.id] ?? "account-other";
}

function ServiceRows({ items }: { items: MemberServiceDefinition[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-border/65 bg-card/75 shadow-sm">
      {items.map((item) => {
        const Icon = icons[item.iconKey];

        return (
          <AppLink
            key={item.id}
            to={item.path}
            aria-label={`Fungua ${item.label}`}
            className="group flex min-h-[68px] items-center gap-3 border-b border-border/55 px-3.5 py-3 text-left outline-none transition-colors last:border-0 hover:bg-primary/[0.055] focus-visible:bg-primary/[0.075] focus-visible:ring-2 focus-visible:ring-primary/50 sm:gap-4 sm:px-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground sm:text-base">{item.label}</span>
              <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground sm:text-sm">{item.description}</span>
            </span>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary" aria-hidden="true" />
          </AppLink>
        );
      })}
    </div>
  );
}

export default function MemberServicesPage() {
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
  const query = normalizeSearch(search);
  const filtered = query ? visibleServices.filter((item) => normalizeSearch(`${item.label} ${item.description}`).includes(query)) : visibleServices;
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
          <h1 className="text-3xl font-bold tracking-tight">Zaidi</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Pata huduma na maeneo mengine ya Kanisa Connect.
          </p>
        </div>
      </header>

      <label className="relative block max-w-xl">
        <span className="sr-only">Tafuta huduma</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tafuta huduma..."
          aria-label="Tafuta huduma"
          className="h-11 rounded-2xl border-border/70 bg-card/75 pl-11 text-sm shadow-sm"
        />
      </label>

      <div className="space-y-5">
        {query ? (
          <section aria-labelledby="services-search-results">
            <h2 id="services-search-results" className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              Matokeo
            </h2>
            {filtered.length ? (
              <ServiceRows items={filtered} />
            ) : (
              <div className="rounded-[22px] border border-border/65 bg-card/70 px-5 py-8 text-center text-sm text-muted-foreground">
                Hakuna huduma iliyopatikana.
              </div>
            )}
          </section>
        ) : (
          groupedServices.map((group) => (
            <section key={group.id} aria-labelledby={`services-${group.id}`} className="space-y-2">
              <div className="px-1">
                <h2 id={`services-${group.id}`} className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group.label}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground/80">{group.description}</p>
              </div>
              <ServiceRows items={group.items} />
            </section>
          ))
        )}
      </div>
    </main>
  );
}
