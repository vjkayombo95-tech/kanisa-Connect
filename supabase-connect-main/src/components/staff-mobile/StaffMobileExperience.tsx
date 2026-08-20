import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronLeft, Home, MoreHorizontal, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ChurchDashboardIntelligence } from "@/components/church-admin/ChurchDashboardIntelligence";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useLivestreamPermission } from "@/hooks/use-church-livestream";
import { useRadioPermission } from "@/hooks/use-church-radio";
import type { StaffMobileConfig, StaffService } from "@/lib/staff-mobile-registry";
import { roleLabel } from "@/lib/staff-mobile-role";
import { cn } from "@/lib/utils";

function MobileLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  const location = useLocation();
  return <Link to={to} state={{ from: location.pathname }} className={className}>{children}</Link>;
}

export function useVisibleStaffServices(config: StaffMobileConfig) {
  const features = useFeatureAccess();
  const livestream = useLivestreamPermission("manage");
  const radio = useRadioPermission("manage");
  const services = useMemo(() => config.services.filter((service) => {
    if (service.featureKey) {
      const state = features.getFeatureState(service.featureKey);
      if (!state.exists || !state.visible) return false;
    }
    if (service.livestreamPermission && livestream.data !== true) return false;
    if (service.radioPermission && radio.data !== true) return false;
    return true;
  }), [config.services, features, livestream.data, radio.data]);
  return { services, isLoading: features.isLoading || (config.services.some((service) => service.livestreamPermission) && livestream.isLoading) || (config.services.some((service) => service.radioPermission) && radio.isLoading) };
}

export function StaffMobileHome({ config, contextLabel }: { config: StaffMobileConfig; contextLabel?: string | null }) {
  const { profile, user } = useAuth();
  const { services, isLoading } = useVisibleStaffServices(config);
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "karibu";
  const workspaceLabel = config.workspace === "community" ? "Uongozi wa jumuiya" : roleLabel(config.workspace);
  const primary = services.filter((service) => service.primary).slice(0, 4);

  return <div className="space-y-7 lg:hidden" data-testid={`staff-mobile-home-${config.workspace}`}>
    <section className="overflow-hidden rounded-[28px] border border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 shadow-xl shadow-black/20">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/80">Kanisa Connect</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Habari, {String(name).split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-zinc-400">{workspaceLabel}{contextLabel ? ` · ${contextLabel}` : ""}</p>
    </section>
    <section aria-labelledby="staff-primary-actions">
      <h2 id="staff-primary-actions" className="mb-3 text-lg font-semibold">Ungependa kufanya nini?</h2>
      {isLoading ? <div className="h-56 animate-pulse rounded-[22px] bg-muted" aria-label="Inapakia huduma" /> : primary.length ? (
        <div className="grid grid-cols-2 gap-3">{primary.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
      ) : <p className="rounded-[22px] border bg-card p-5 text-sm text-muted-foreground">Hakuna huduma iliyothibitishwa kwa sasa.</p>}
      <MobileLink to={config.servicesRoute} className="mt-3 flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">Huduma zote →</MobileLink>
    </section>
    {config.workspace === "admin" || config.workspace === "pastoral" || config.workspace === "finance" ? <ChurchDashboardIntelligence compact /> : null}
    <section className="rounded-[22px] border bg-card/70 p-4"><h2 className="font-semibold">Muhtasari</h2><p className="mt-1 text-sm text-muted-foreground">Fungua huduma iliyopewa kipaumbele kuona kazi zinazohitaji umakini.</p></section>
  </div>;
}

function ServiceCard({ service }: { service: StaffService }) {
  const Icon = service.icon;
  return <MobileLink to={service.route} className="flex min-h-28 flex-col justify-between rounded-[22px] border bg-card/80 p-4 outline-none transition hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] motion-reduce:transform-none"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5 stroke-[1.8]" aria-hidden="true" /></span><span className="text-sm font-semibold">{service.label}</span></MobileLink>;
}

export function StaffMobileServices({ config }: { config: StaffMobileConfig }) {
  const { services, isLoading } = useVisibleStaffServices(config);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const map = new Map<string, StaffService[]>();
    for (const service of services) {
      if (normalized && !`${service.label} ${service.id}`.toLocaleLowerCase().includes(normalized)) continue;
      map.set(service.group, [...(map.get(service.group) ?? []), service]);
    }
    return [...map.entries()];
  }, [query, services]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return <div className="mx-auto max-w-xl space-y-5" data-testid={`staff-mobile-services-${config.workspace}`}>
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kanisa Connect</p><h1 className="mt-2 text-2xl font-bold">Huduma zote</h1><p className="mt-1 text-sm text-muted-foreground">Huduma zilizothibitishwa kwa nafasi hii.</p></div>
    <label className="relative block"><span className="sr-only">Tafuta huduma</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tafuta huduma…" className="min-h-12 w-full rounded-2xl border bg-card pl-12 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
    {isLoading ? <div className="h-48 animate-pulse rounded-[22px] bg-muted" aria-label="Inapakia huduma" /> : <div className="space-y-3">{groups.map(([group, items], index) => {
      const expanded = !!query.trim() || openGroup === group || (!openGroup && index === 0);
      return <section key={group} className="overflow-hidden rounded-[22px] border bg-card/70"><button type="button" aria-expanded={expanded} aria-controls={`staff-services-${index}`} onClick={() => setOpenGroup(expanded ? "" : group)} className="flex min-h-14 w-full items-center justify-between px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><span><span className="block font-semibold">{group}</span><span className="text-xs text-muted-foreground">Huduma {items.length}</span></span><ChevronDown className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")} aria-hidden="true" /></button><div id={`staff-services-${index}`} hidden={!expanded} className="border-t p-2">{items.map((service) => { const Icon = service.icon; return <MobileLink key={service.id} to={service.route} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><span>{service.label}</span></MobileLink>; })}</div></section>;
    })}{!groups.length ? <p className="py-8 text-center text-sm text-muted-foreground">Hakuna huduma inayolingana na utafutaji huu.</p> : null}</div>}
  </div>;
}

export function StaffMobileBottomNav({ config }: { config: StaffMobileConfig }) {
  const location = useLocation();
  const items = [{ label: "Nyumbani", to: config.home, icon: Home }, { label: config.workLabel, to: config.workRoute, icon: BriefcaseBusiness }, { label: "Zaidi", to: config.servicesRoute, icon: MoreHorizontal }];
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Urambazaji wa nafasi"><div className="mx-auto grid max-w-lg grid-cols-3 px-3 py-1.5">{items.map((item) => { const Icon = item.icon; const active = location.pathname === item.to; return <MobileLink key={item.to} to={item.to} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary", active && "bg-primary/[0.07] text-primary")}><Icon className="h-5 w-5" aria-hidden="true" /><span>{item.label}</span></MobileLink>; })}</div></nav>;
}

export function StaffMobileBackHeader({ config, title }: { config: StaffMobileConfig; title: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const primary = [config.home, config.workRoute, config.servicesRoute];
  if (primary.includes(location.pathname.replace(/\/$/, ""))) return null;
  const stateFrom = (location.state as { from?: unknown } | null)?.from;
  const root = config.workspace === "community" ? config.home.slice(0, config.home.lastIndexOf("/")) : config.home;
  const target = typeof stateFrom === "string" && stateFrom.startsWith(root) && stateFrom !== location.pathname ? stateFrom : config.home;
  return <button type="button" onClick={() => navigate(target, { replace: true })} className="mb-4 flex min-h-12 min-w-0 items-center gap-2 rounded-2xl pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden" aria-label={`Rudi kutoka ${title}`}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></span><span className="truncate text-lg font-semibold">{title}</span></button>;
}
