import { useMemo, useState } from "react";
import {
  Bell,
  BookHeart,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Church,
  CircleHelp,
  Flame,
  HandCoins,
  HeartHandshake,
  Landmark,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Input } from "@/components/ui/input";
import { useWorkspaceContext, type WorkspaceIcon, type WorkspaceNavigationItem } from "@/components/workspace/framework";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { cn } from "@/lib/utils";

type ServiceSectionId = "frequent" | "worship" | "faith" | "parish" | "more";

type ServicePresentation = {
  label: string;
  description: string;
  section: ServiceSectionId;
  icon: WorkspaceIcon;
};

const presentationById: Record<string, ServicePresentation> = {
  "contribution-history": { label: "Michango", description: "Angalia historia ya michango", section: "frequent", icon: HandCoins },
  giving: { label: "Toa Mchango", description: "Changia parokia yako", section: "frequent", icon: HandCoins },
  "mass-intentions": { label: "Nia ya Misa", description: "Weka au fuatilia nia", section: "frequent", icon: HeartHandshake },
  announcements: { label: "Matangazo", description: "Taarifa mpya za parokia", section: "frequent", icon: Megaphone },
  calendar: { label: "Ratiba ya Misa", description: "Misa na matukio ya wiki hii", section: "frequent", icon: CalendarDays },
  today: { label: "Leo Kanisani", description: "Ibada na taarifa za leo", section: "worship", icon: Flame },
  "daily-readings": { label: "Masomo ya Leo", description: "Injili na masomo ya leo", section: "worship", icon: BookOpen },
  "liturgical-calendar": { label: "Kalenda ya Liturujia", description: "Sikukuu na majira ya Kanisa", section: "faith", icon: CalendarDays },
  bible: { label: "Biblia", description: "Soma Biblia", section: "faith", icon: BookOpen },
  "prayer-library": { label: "Sala", description: "Sala mbalimbali", section: "faith", icon: BookHeart },
  prayer: { label: "Ombi la Maombi", description: "Tuma na fuatilia ombi", section: "faith", icon: HeartHandshake },
  reflection: { label: "Tafakari", description: "Tafakari za kiroho", section: "faith", icon: Sparkles },
  saints: { label: "Watakatifu", description: "Historia za watakatifu", section: "faith", icon: Star },
  "my-parish": { label: "Parokia Yangu", description: "Taarifa na mawasiliano ya parokia", section: "parish", icon: Landmark },
  channels: { label: "Jumuiya", description: "Ungana na jumuiya yako", section: "parish", icon: Users },
  ministries: { label: "Huduma za Kanisa", description: "Vikundi na huduma za parokia", section: "parish", icon: Church },
  "kanisa-ai": { label: "Uliza Kanisa", description: "Pata msaada wa huduma za parokia", section: "parish", icon: MessageCircle },
  events: { label: "Matukio", description: "Matukio yajayo ya parokia", section: "more", icon: CalendarDays },
  "event-requests": { label: "Omba Tukio", description: "Wasilisha ombi la tukio", section: "more", icon: Bell },
  pledges: { label: "Ahadi za Michango", description: "Angalia ahadi zako", section: "more", icon: HandCoins },
  "community-help": { label: "Msaada wa Jumuiya", description: "Omba au toa msaada", section: "more", icon: CircleHelp },
};

const sectionDefinitions: Array<{ id: ServiceSectionId; title: string; icon: WorkspaceIcon }> = [
  { id: "frequent", title: "Huduma za Haraka", icon: Flame },
  { id: "worship", title: "Ibada", icon: Church },
  { id: "faith", title: "Imani", icon: BookOpen },
  { id: "parish", title: "Parokia", icon: Landmark },
  { id: "more", title: "Zaidi", icon: Settings },
];

const MORE_INITIAL_LIMIT = 4;

type PresentedService = WorkspaceNavigationItem & ServicePresentation;

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("sw").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function presentService(item: WorkspaceNavigationItem): PresentedService {
  const known = presentationById[item.id];
  return {
    ...item,
    label: known?.label ?? item.label,
    description: known?.description ?? "Fungua huduma hii",
    section: known?.section ?? "more",
    icon: known?.icon ?? item.icon ?? Church,
  };
}

function DesktopServicesList({ items }: { items: PresentedService[] }) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border bg-card shadow-sm lg:block">
      {items.map((item) => {
        const Icon = item.icon;
        return <AppLink key={item.id} to={item.to} className="flex min-h-16 items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/50"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-bold">{item.label}</span><span className="block text-xs text-muted-foreground">{item.description}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" /></AppLink>;
      })}
    </div>
  );
}

function MobileServiceRows({ items }: { items: PresentedService[] }) {
  return (
    <div className="overflow-hidden rounded-b-3xl border-x border-b border-border/70 bg-card">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <AppLink key={item.id} to={item.to} className="group flex min-h-[72px] items-center gap-4 border-b border-border/60 px-4 py-3 transition duration-200 last:border-0 motion-reduce:transition-none active:scale-[0.985] active:bg-muted/60">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-200 motion-reduce:transition-none group-active:bg-primary/15"><Icon className="h-6 w-6" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-5">{item.label}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.description}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </AppLink>
        );
      })}
    </div>
  );
}

export default function MemberServicesPage() {
  const workspaceContext = useWorkspaceContext();
  const { getFeatureState } = useFeatureAccess();
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<ServiceSectionId, boolean>>({
    frequent: true,
    worship: false,
    faith: false,
    parish: false,
    more: false,
  });
  const [showAllMore, setShowAllMore] = useState(false);
  const allItems = useMemo(
    () => (workspaceContext?.workspace.navigation ?? [])
      .flatMap((group) => group.items)
      .filter((item) => item.to !== "/portal" && item.to !== "/portal/services")
      .filter((item) => !item.featureFlag || getFeatureState(item.featureFlag).visible)
      .map(presentService),
    [getFeatureState, workspaceContext?.workspace.navigation],
  );
  const query = normalizeSearch(search);
  const filteredItems = useMemo(
    () => query ? allItems.filter((item) => normalizeSearch(`${item.label} ${item.description}`).includes(query)) : allItems,
    [allItems, query],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24" data-testid="member-services-page">
      <div>
        <p className="text-sm font-bold text-primary">Kanisa Connect</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Huduma zote</h1>
        <p className="mt-2 text-muted-foreground">Chagua huduma unayotaka kufungua.</p>
      </div>

      <div className="relative lg:hidden">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tafuta huduma..." aria-label="Tafuta huduma" className="h-13 rounded-2xl bg-card pl-12 text-base shadow-sm" />
      </div>

      <div className="space-y-8 lg:hidden">
        {query ? (
          <section aria-labelledby="service-search-results" className="animate-in fade-in duration-200 motion-reduce:animate-none">
            <h2 id="service-search-results" className="mb-3 text-lg font-bold">Matokeo</h2>
            {filteredItems.length ? <MobileServiceRows items={filteredItems} /> : <div className="rounded-3xl bg-muted/60 px-5 py-8 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-bold">Hakuna huduma iliyopatikana.</p><p className="mt-1 text-sm text-muted-foreground">Jaribu jina jingine la huduma.</p></div>}
          </section>
        ) : sectionDefinitions.map((section) => {
          const items = filteredItems.filter((item) => item.section === section.id);
          if (!items.length) return null;
          const SectionIcon = section.icon;
          const expanded = expandedSections[section.id];
          const visibleItems = section.id === "more" && !showAllMore ? items.slice(0, MORE_INITIAL_LIMIT) : items;
          const remainingCount = section.id === "more" ? Math.max(0, items.length - MORE_INITIAL_LIMIT) : 0;
          const contentId = `services-${section.id}-content`;
          return (
            <section key={section.id} aria-labelledby={`services-${section.id}`} className="rounded-3xl shadow-sm">
              <h2 id={`services-${section.id}`}>
                <button type="button" onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !current[section.id] }))} aria-expanded={expanded} aria-controls={contentId} className={cn("flex min-h-16 w-full items-center gap-3 rounded-3xl border border-border/70 bg-card px-4 py-3 text-left text-lg font-bold outline-none transition-colors duration-200 motion-reduce:transition-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", expanded && "rounded-b-none border-b-0")}>
                  <SectionIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{section.title}</span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground" aria-label={`${items.length} huduma`}>{items.length}</span>
                  <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
                </button>
              </h2>
              {expanded ? (
                <div id={contentId} className="animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                  <MobileServiceRows items={visibleItems} />
                  {section.id === "more" && remainingCount > 0 ? (
                    <button type="button" onClick={() => setShowAllMore((current) => !current)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-b-3xl border-x border-b border-border/70 bg-card px-4 py-3 text-sm font-bold text-primary outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                      {showAllMore ? "Onyesha chache" : `Ona huduma nyingine (${remainingCount})`}
                      <ChevronRight className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", showAllMore && "-rotate-90")} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <DesktopServicesList items={allItems} />
    </div>
  );
}
