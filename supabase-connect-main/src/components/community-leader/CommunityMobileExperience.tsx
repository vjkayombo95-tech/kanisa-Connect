import { useState } from "react";
import { ChevronDown, HandCoins, Home, MoreHorizontal, Search, Target, Users } from "lucide-react";
import { useLocation } from "react-router-dom";

import { AppLink } from "@/components/AppLink";
import { cn } from "@/lib/utils";

const services = [
  { label: "Wanachama", to: "members", icon: Users, category: "Jumuiya" },
  { label: "Michango", to: "contributions", icon: HandCoins, category: "Fedha" },
  { label: "Ahadi", to: "pledges", icon: Target, category: "Fedha" },
  { label: "Ripoti", to: "reports", icon: MoreHorizontal, category: "Uendeshaji" },
  { label: "Viongozi", to: "leadership", icon: Users, category: "Jumuiya" },
  { label: "Mawasiliano", to: "channels", icon: MoreHorizontal, category: "Mawasiliano" },
];

export function CommunityMobileHome({ base, name, role }: { base: string; name: string; role: string }) {
  return <div className="space-y-7 lg:hidden"><section className="rounded-[28px] border border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/80">Kanisa Connect</p><h1 className="mt-3 text-2xl font-bold">Habari, kiongozi</h1><p className="mt-1 text-sm text-zinc-400">{role} · {name}</p></section><section><h2 className="mb-3 text-lg font-semibold">Ungependa kufanya nini?</h2><div className="grid grid-cols-2 gap-3">{services.slice(0, 4).map((item) => { const Icon = item.icon; return <AppLink key={item.to} to={`${base}/${item.to}`} className="flex min-h-28 flex-col justify-between rounded-[22px] border border-white/10 bg-card/80 p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="text-sm font-semibold">{item.label}</span></AppLink>; })}</div><AppLink to={`${base}/services`} className="mt-3 flex min-h-12 items-center justify-center text-sm font-semibold text-primary">Huduma zote →</AppLink></section></div>;
}

export function CommunityMobileServices({ base }: { base: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("Jumuiya");
  const categories = [...new Set(services.map((item) => item.category))];
  const matching = services.filter((item) => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="space-y-5 lg:hidden"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kanisa Connect</p><h1 className="mt-2 text-2xl font-bold">Huduma zote</h1></div><label className="relative block"><span className="sr-only">Tafuta huduma</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tafuta huduma…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-card pl-12 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>{categories.map((category) => { const items = matching.filter((item) => item.category === category); if (!items.length) return null; const expanded = !!query || open === category; return <section key={category} className="overflow-hidden rounded-[22px] border border-white/10 bg-card/70"><button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? "" : category)} className="flex min-h-14 w-full items-center justify-between px-4"><span className="text-left"><span className="block font-semibold">{category}</span><span className="text-xs text-muted-foreground">Huduma {items.length}</span></span><ChevronDown className={cn("h-5 w-5", expanded && "rotate-180")} /></button><div hidden={!expanded} className="border-t border-white/10 p-2">{items.map((item) => <AppLink key={item.to} to={`${base}/${item.to}`} className="flex min-h-12 items-center rounded-2xl px-3 text-sm font-medium">{item.label}</AppLink>)}</div></section>; })}</div>;
}

export function CommunityMobileBottomNav({ base }: { base: string }) {
  const location = useLocation();
  const items = [{ label: "Nyumbani", to: `${base}/dashboard`, icon: Home }, { label: "Wanachama", to: `${base}/members`, icon: Users }, { label: "Zaidi", to: `${base}/services`, icon: MoreHorizontal }];
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Urambazaji wa jumuiya"><div className="mx-auto grid max-w-lg grid-cols-3 px-3 py-1.5">{items.map((item) => { const Icon = item.icon; const active = location.pathname === item.to; return <AppLink key={item.to} to={item.to} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-muted-foreground", active && "text-primary")}><Icon className="h-5 w-5" /><span>{item.label}</span></AppLink>; })}</div></nav>;
}
