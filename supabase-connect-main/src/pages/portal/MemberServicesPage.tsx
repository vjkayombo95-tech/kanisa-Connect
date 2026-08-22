import { useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Church,
  CircleHelp,
  Flame,
  HandCoins,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  Radio,
  Search,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Input } from "@/components/ui/input";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import type { PortalFeatureKey } from "@/lib/portal-features";
import { cn } from "@/lib/utils";

type SectionId = "frequent" | "worship" | "faith" | "community" | "more";

type ServiceItem = {
  id: string;
  label: string;
  description: string;
  section: SectionId;
  to: string;
  icon: typeof Church;
  featureKey: PortalFeatureKey | null;
  requiresExplicitChurchEnable?: boolean;
  requiresExistingFeature?: boolean;
};

// Every destination below exists in the production MemberRoutes table.
const services: ServiceItem[] = [
  { id: "giving", label: "Toa Mchango", description: "Changia parokia yako", section: "frequent", to: "/portal/give", icon: HandCoins, featureKey: "give" },
  { id: "mass-intentions", label: "Nia za Misa", description: "Wasilisha au fuatilia nia", section: "frequent", to: "/portal/mass-intentions", icon: HeartHandshake, featureKey: "mass_intentions" },
  { id: "announcements", label: "Matangazo", description: "Taarifa mpya za parokia", section: "frequent", to: "/portal/announcements", icon: Megaphone, featureKey: "announcements" },
  { id: "kanisa-ai", label: "Uliza Kanisa", description: "Uliza kuhusu huduma za kanisa lako", section: "frequent", to: "/portal/kanisa-ai", icon: MessageCircle, featureKey: "kanisa_ai", requiresExplicitChurchEnable: true },
  { id: "history", label: "Historia ya Michango", description: "Angalia michango na risiti", section: "more", to: "/portal/contribution-history", icon: HandCoins, featureKey: null },
  { id: "daily-readings", label: "Masomo ya Leo", description: "Neno la Mungu la leo", section: "worship", to: "/portal/daily-readings", icon: BookOpen, featureKey: null },
  { id: "liturgical-calendar", label: "Kalenda ya Liturujia", description: "Sikukuu na majira ya Kanisa", section: "worship", to: "/portal/liturgical-calendar", icon: CalendarDays, featureKey: null },
  { id: "sermons", label: "Mahubiri", description: "Soma mahubiri ya parokia", section: "worship", to: "/portal/sermons", icon: Church, featureKey: "sermons" },
  { id: "radio", label: "Radio", description: "Sikiliza radio ya parokia", section: "worship", to: "/portal/radio", icon: Radio, featureKey: "radio" },
  { id: "bible", label: "Biblia", description: "Soma Biblia", section: "faith", to: "/portal/bible", icon: BookOpen, featureKey: null },
  { id: "library", label: "Watakatifu", description: "Jifunze maisha ya watakatifu", section: "faith", to: "/portal/library", icon: BookOpen, featureKey: null },
  { id: "prayers", label: "Sala", description: "Soma sala zilizochapishwa", section: "faith", to: "/portal/prayers", icon: ScrollText, featureKey: null },
  { id: "reflections", label: "Tafakari", description: "Tafakari za masomo ya kila siku", section: "faith", to: "/portal/reflections", icon: Sparkles, featureKey: null },
  { id: "prayer-requests", label: "Ombi la Maombi", description: "Tuma na fuatilia ombi", section: "faith", to: "/portal/prayer-requests", icon: HeartHandshake, featureKey: "prayer_requests" },
  { id: "channels", label: "Jumuiya", description: "Ungana na jumuiya yako", section: "community", to: "/portal/channels", icon: Users, featureKey: "channels" },
  { id: "ministries", label: "Huduma za Parokia", description: "Jiunge na huduma ya parokia", section: "community", to: "/portal/ministries", icon: Users, featureKey: "ministries", requiresExistingFeature: true },
  { id: "community-help", label: "Msaada wa Jumuiya", description: "Omba au toa msaada", section: "community", to: "/portal/community-help", icon: CircleHelp, featureKey: "community_help" },
  { id: "events", label: "Matukio", description: "Matukio yajayo ya parokia", section: "more", to: "/portal/events", icon: CalendarDays, featureKey: "events" },
  { id: "parish-calendar", label: "Kalenda ya Parokia", description: "Misa na matukio yajayo", section: "more", to: "/portal/calendar", icon: CalendarDays, featureKey: "events" },
  { id: "event-requests", label: "Omba Tukio", description: "Wasilisha ombi la tukio", section: "more", to: "/portal/event-requests", icon: Bell, featureKey: "events" },
  { id: "pledges", label: "Ahadi za Michango", description: "Angalia ahadi zako", section: "more", to: "/portal/pledges", icon: HandCoins, featureKey: "pledges" },
  { id: "bible-verses", label: "Mistari ya Biblia", description: "Mistari ya kutia moyo", section: "more", to: "/portal/bible-verses", icon: BookOpen, featureKey: "bible_verses" },
];

const sections: Array<{ id: SectionId; title: string; icon: typeof Church }> = [
  { id: "frequent", title: "Huduma za Haraka", icon: Flame },
  { id: "worship", title: "Ibada", icon: Church },
  { id: "faith", title: "Imani", icon: BookOpen },
  { id: "community", title: "Jumuiya", icon: Users },
  { id: "more", title: "Zaidi", icon: Settings },
];

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("sw").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function ServiceRows({ items }: { items: ServiceItem[] }) {
  return (
    <div className="overflow-hidden rounded-b-3xl border-x border-b border-border/70 bg-card">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <AppLink key={item.id} to={item.to} className="group flex min-h-[72px] items-center gap-4 border-b border-border/60 px-4 py-3 transition last:border-0 hover:bg-muted/40 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold">{item.label}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </AppLink>
        );
      })}
    </div>
  );
}

export default function MemberServicesPage() {
  const { getFeatureState, isFeatureExplicitlyEnabledForChurch } = useFeatureAccess();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    frequent: true,
    worship: false,
    faith: false,
    community: false,
    more: false,
  });
  const visibleServices = useMemo(
    () => services.filter((item) => {
      if (!item.featureKey) return true;
      if (item.requiresExplicitChurchEnable) return isFeatureExplicitlyEnabledForChurch(item.featureKey);
      const state = getFeatureState(item.featureKey);
      return (!item.requiresExistingFeature || state.exists) && state.visible;
    }),
    [getFeatureState, isFeatureExplicitlyEnabledForChurch],
  );
  const query = normalizeSearch(search);
  const filtered = useMemo(
    () => query ? visibleServices.filter((item) => normalizeSearch(`${item.label} ${item.description}`).includes(query)) : visibleServices,
    [query, visibleServices],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-28 lg:px-8 lg:pb-8" data-testid="member-services-page">
      <div>
        <p className="text-sm font-bold text-primary">Kanisa Connect</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Huduma zote</h1>
        <p className="mt-2 text-muted-foreground">Chagua huduma unayotaka kufungua.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tafuta huduma..." aria-label="Tafuta huduma" className="h-12 rounded-2xl bg-card pl-12 text-base shadow-sm" />
      </div>

      <div className="space-y-5">
        {query ? (
          <section aria-labelledby="service-search-results">
            <h2 id="service-search-results" className="mb-3 text-lg font-bold">Matokeo</h2>
            {filtered.length ? <div className="rounded-t-3xl border border-b-0 bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">Huduma {filtered.length}</div> : null}
            {filtered.length ? <ServiceRows items={filtered} /> : <div className="rounded-3xl bg-muted/60 px-5 py-8 text-center text-sm text-muted-foreground">Hakuna huduma iliyopatikana.</div>}
          </section>
        ) : sections.map((section) => {
          const items = filtered.filter((item) => item.section === section.id);
          if (!items.length) return null;
          const SectionIcon = section.icon;
          const isExpanded = expanded[section.id];
          const contentId = `services-${section.id}`;
          return (
            <section key={section.id}>
              <button type="button" onClick={() => setExpanded((current) => ({ ...current, [section.id]: !current[section.id] }))} aria-expanded={isExpanded} aria-controls={contentId} className={cn("flex min-h-16 w-full items-center gap-3 rounded-3xl border border-border/70 bg-card px-4 py-3 text-left text-lg font-bold outline-none transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", isExpanded && "rounded-b-none border-b-0")}>
                <SectionIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">{section.title}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
                <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
              </button>
              {isExpanded ? <div id={contentId}><ServiceRows items={items} /></div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
