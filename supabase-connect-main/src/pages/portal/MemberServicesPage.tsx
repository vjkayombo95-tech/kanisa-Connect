import { useMemo, useState } from "react";
import { BookOpen, CalendarDays, ChevronRight, Church, HandCoins, HeartHandshake, Megaphone, MessageCircle, Radio, Search, Sparkles, Users } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { Input } from "@/components/ui/input";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { getYouTubeEmbedUrl, presentation } from "@/lib/church-livestreams";
import { memberServiceGroups, memberServiceRegistry, type MemberServiceDefinition, type MemberServiceIconKey } from "@/lib/member-service-registry";

const icons: Record<MemberServiceIconKey, typeof Church> = {
  book: BookOpen, calendar: CalendarDays, church: Church, giving: HandCoins, intention: HeartHandshake,
  announcement: Megaphone, message: MessageCircle, prayer: Sparkles, radio: Radio, users: Users,
};

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("sw").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function ServiceRows({ items }: { items: MemberServiceDefinition[] }) {
  return <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
    {items.map((item) => { const Icon = icons[item.iconKey]; return <AppLink key={item.id} to={item.path} className="group flex min-h-[72px] items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/40">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block font-bold">{item.label}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span></span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </AppLink>; })}
  </div>;
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
    return { ...base, path: `/portal/live/${stream.id}`, showInServices: true, description: stream.status === "live" ? "Tazama Misa moja kwa moja" : "Misa inaanza hivi karibuni" };
  }, [livestream.churchId, livestream.data, livestream.error, livestream.featureEnabled, livestream.featureLoading, livestream.isLoading]);

  const visibleServices = useMemo(() => [...memberServiceRegistry.filter((item) => item.showInServices), ...(livestreamService ? [livestreamService] : [])].filter((item) => {
    if (!item.ordinaryMemberAllowed) return false;
    if (!item.featureKey) return true;
    if (item.requiresExplicitChurchEnable) return isFeatureExplicitlyEnabledForChurch(item.featureKey);
    const state = getFeatureState(item.featureKey);
    return (!item.requiresExistingFeature || state.exists) && state.visible;
  }), [getFeatureState, isFeatureExplicitlyEnabledForChurch, livestreamService]);
  const query = normalizeSearch(search);
  const filtered = query ? visibleServices.filter((item) => normalizeSearch(`${item.label} ${item.description}`).includes(query)) : visibleServices;

  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-28 lg:px-8 lg:pb-8" data-testid="member-services-page">
    <div><p className="text-sm font-bold text-primary">Kanisa Connect</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Huduma zote</h1><p className="mt-2 text-muted-foreground">Chagua huduma unayotaka kufungua.</p></div>
    <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tafuta huduma..." aria-label="Tafuta huduma" className="h-12 rounded-2xl bg-card pl-12 text-base shadow-sm" /></div>
    <div className="space-y-7">{query ? <section><h2 className="mb-3 text-lg font-bold">Matokeo</h2>{filtered.length ? <ServiceRows items={filtered} /> : <div className="rounded-3xl bg-muted/60 px-5 py-8 text-center text-sm text-muted-foreground">Hakuna huduma iliyopatikana.</div>}</section> : memberServiceGroups.map((group) => { const items = filtered.filter((item) => item.group === group.id); return items.length ? <section key={group.id} aria-labelledby={`services-${group.id}`}><h2 id={`services-${group.id}`} className="mb-3 text-lg font-bold">{group.label}</h2><ServiceRows items={items} /></section> : null; })}</div>
  </div>;
}
