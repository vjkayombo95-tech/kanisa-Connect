import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppLink } from "@/components/AppLink";
import { SharedChurchLiveMedia } from "@/components/portal/SharedChurchLiveMedia";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { WorkspaceConfig, WorkspaceId, WorkspaceNavigationGroup, WorkspaceNavigationItem } from "./framework";

const mobileRoleCopy: Record<Exclude<WorkspaceId, "member">, {
  role: string;
  primaryIds: string[];
  workId: string;
  workLabel: string;
  groupLabels: Record<string, string>;
}> = {
  church_admin: {
    role: "Uendeshaji wa parokia",
    primaryIds: ["approve-members", "post-announcement", "create-event", "attendance", "invite-member", "view-reports"],
    workId: "members",
    workLabel: "Wanachama",
    groupLabels: { "admin-home": "Kawaida", "admin-people": "Wanachama", "admin-liturgy": "Ibada", operations: "Uendeshaji", finance: "Fedha", "admin-administration": "Usimamizi" },
  },
  pastoral: {
    role: "Huduma ya kichungaji",
    primaryIds: ["mass-intentions", "prayer-requests", "announcements", "sacraments", "finance-summary"],
    workId: "mass-intentions",
    workLabel: "Nia",
    groupLabels: { "pastoral-home": "Kawaida", "pastoral-care": "Huduma ya kichungaji", "pastoral-liturgy": "Ibada", operations: "Uendeshaji" },
  },
  finance: {
    role: "Usimamizi wa fedha",
    primaryIds: ["record-contribution", "view-receipts", "export-report", "outstanding-pledges", "monthly-report"],
    workId: "contributions",
    workLabel: "Michango",
    groupLabels: { "finance-home": "Kawaida", finance: "Fedha", "finance-parish": "Parokia", "finance-administration": "Usimamizi" },
  },
  super_admin: {
    role: "Usimamizi wa mfumo",
    primaryIds: ["churches", "monitoring", "cms", "imports", "kanisa-ai"],
    workId: "churches",
    workLabel: "Makanisa",
    groupLabels: { "platform-home": "Kawaida", "platform-tenants": "Makanisa", "platform-finance": "Fedha", "platform-content": "Maudhui", "platform-administration": "Mfumo" },
  },
};

const itemLabels: Record<string, string> = {
  members: "Wanachama", "approve-members": "Wanachama", "invite-member": "Mialiko",
  announcements: "Matangazo", "post-announcement": "Matangazo", events: "Matukio", "create-event": "Matukio",
  attendance: "Mahudhurio", contributions: "Michango", "record-contribution": "Michango", receipts: "Risiti",
  "view-receipts": "Malipo na risiti", reports: "Ripoti", "export-report": "Ripoti", "monthly-report": "Ripoti",
  pledges: "Ahadi", "outstanding-pledges": "Ahadi", "mass-intentions": "Nia za Misa", "prayer-requests": "Maombi",
  sacraments: "Sakramenti", churches: "Makanisa", monitoring: "Afya ya Mfumo", cms: "Maudhui Katoliki",
  imports: "Uingizaji Data", "kanisa-ai": "Kanisa AI", calendar: "Kalenda ya Parokia", settings: "Mipangilio",
  communities: "Jumuiya", ministries: "Huduma", "daily-readings": "Masomo ya Leo", bible: "Biblia",
  livestreams: "Matangazo Mubashara", sermons: "Mahubiri",
};

const itemDescriptions: Record<string, string> = {
  livestreams: "Matangazo ya moja kwa moja",
  sermons: "Mahubiri yaliyorekodiwa",
};

function displayLabel(item: WorkspaceNavigationItem) {
  return itemLabels[item.id] ?? item.label;
}

function orderedActions(items: WorkspaceNavigationItem[], preferredIds: string[]) {
  return [...items]
    .sort((a, b) => {
      const ai = preferredIds.indexOf(a.id);
      const bi = preferredIds.indexOf(b.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    })
    .slice(0, 4);
}

export function RoleMobileHome({ workspace, visibleQuickActions }: { workspace: WorkspaceConfig; visibleQuickActions: WorkspaceNavigationItem[] }) {
  const { profile, user } = useAuth();
  if (workspace.id === "member") return null;
  const config = mobileRoleCopy[workspace.id];
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "karibu";
  const church = profile?.church_name ?? profile?.church?.name;
  const actions = orderedActions(visibleQuickActions, config.primaryIds);

  return (
    <div className="space-y-7 lg:hidden" data-testid={`role-mobile-home-${workspace.id}`}>
      <section className="overflow-hidden rounded-[28px] border border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 shadow-xl shadow-black/20">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/80">Kanisa Connect</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Habari, {String(name).split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-zinc-400">{config.role}{church ? ` · ${church}` : ""}</p>
      </section>
      {workspace.id !== "super_admin" ? <SharedChurchLiveMedia churchName={church} /> : null}
      <section aria-labelledby="role-mobile-actions">
        <h2 id="role-mobile-actions" className="mb-3 text-lg font-semibold">Ungependa kufanya nini?</h2>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return <AppLink key={action.id} to={action.to} className="flex min-h-28 flex-col justify-between rounded-[22px] border border-white/10 bg-card/80 p-4 outline-none transition hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] motion-reduce:transform-none"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{Icon ? <Icon className="h-5 w-5 stroke-[1.8]" aria-hidden="true" /> : null}</span><span className="text-sm font-semibold">{displayLabel(action)}</span></AppLink>;
          })}
        </div>
        <AppLink to={`/${workspace.id.replace("_", "-")}/services`} className="mt-3 flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">Huduma zote →</AppLink>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-card/60 p-4">
        <h2 className="font-semibold">Muhtasari</h2>
        <p className="mt-1 text-sm text-muted-foreground">Fungua huduma iliyopewa kipaumbele ili kuona taarifa na kazi zinazohitaji umakini.</p>
      </section>
    </div>
  );
}

export function RoleMobileServiceDirectory({ workspace, groups }: { workspace: WorkspaceConfig; groups: WorkspaceNavigationGroup[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null);
  const config = workspace.id === "member" ? null : mobileRoleCopy[workspace.id];
  const filtered = useMemo(() => groups.map((group) => ({ ...group, items: group.items.filter((item) => `${displayLabel(item)} ${item.label} ${itemDescriptions[item.id] ?? ""} ${(item.keywords ?? []).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) })).filter((group) => group.items.length), [groups, query]);

  return <div className="mx-auto max-w-xl space-y-5 lg:hidden" data-testid={`role-mobile-services-${workspace.id}`}>
    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kanisa Connect</p><h1 className="mt-2 text-2xl font-bold">Huduma zote</h1><p className="mt-1 text-sm text-muted-foreground">Huduma unazoruhusiwa kutumia katika nafasi hii.</p></div>
    <label className="relative block"><span className="sr-only">Tafuta huduma</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tafuta huduma…" className="min-h-12 w-full rounded-2xl border border-white/10 bg-card pl-12 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" /></label>
    <div className="space-y-3">
      {filtered.map((group) => { const expanded = query.trim().length > 0 || openId === group.id; return <section key={group.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-card/70"><button type="button" aria-expanded={expanded} aria-controls={`role-services-${group.id}`} onClick={() => setOpenId(expanded ? null : group.id)} className="flex min-h-14 w-full items-center justify-between px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><span><span className="block font-semibold">{config?.groupLabels[group.id] ?? group.label}</span><span className="text-xs text-muted-foreground">Huduma {group.items.length}</span></span><ChevronDown className={cn("h-5 w-5 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" /></button><div id={`role-services-${group.id}`} hidden={!expanded} className="border-t border-white/10 p-2">{group.items.map((item) => { const Icon = item.icon; return <AppLink key={item.id} to={item.to} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary">{Icon ? <Icon className="h-5 w-5 text-primary" aria-hidden="true" /> : null}<span><span className="block">{displayLabel(item)}</span>{itemDescriptions[item.id] ? <span className="block text-xs text-muted-foreground">{itemDescriptions[item.id]}</span> : null}</span></AppLink>; })}</div></section>; })}
      {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">Hakuna huduma inayolingana na utafutaji huu.</p> : null}
    </div>
  </div>;
}

export function getRoleMobileNavigation(workspace: WorkspaceConfig, visibleGroups: WorkspaceNavigationGroup[]) {
  if (workspace.id === "member") return [];
  const config = mobileRoleCopy[workspace.id];
  const root = `/${workspace.id.replace("_", "-")}`;
  const work = visibleGroups.flatMap((group) => group.items).find((item) => item.id === config.workId);
  return [
    { label: "Nyumbani", to: root, kind: "home" as const },
    ...(work ? [{ label: config.workLabel, to: work.to, kind: "work" as const }] : []),
    { label: "Zaidi", to: `${root}/services`, kind: "more" as const },
  ];
}

export function RoleMobileBackHeader({ workspace, title, primaryRoutes }: { workspace: WorkspaceConfig; title: string; primaryRoutes: string[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  if (workspace.id === "member" || primaryRoutes.includes(location.pathname.replace(/\/$/, ""))) return null;
  const stateFrom = (location.state as { from?: unknown } | null)?.from;
  const workspaceRoot = `/${workspace.id.replace("_", "-")}`;
  const target = typeof stateFrom === "string" && stateFrom.startsWith(workspaceRoot) && stateFrom !== location.pathname
    ? stateFrom
    : `${workspaceRoot}/services`;
  return <header className="mb-4 flex min-w-0 items-center lg:hidden" data-testid="role-mobile-back-header"><button type="button" onClick={() => navigate(target)} aria-label={`Rudi kutoka ${title}`} className="group flex min-h-12 min-w-0 items-center gap-2 rounded-2xl pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-primary"><ChevronLeft className="h-6 w-6 stroke-[1.8]" aria-hidden="true" /></span><span className="truncate text-lg font-semibold">{title}</span></button></header>;
}
