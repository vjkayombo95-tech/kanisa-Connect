import { useMemo } from "react";
import { Building2, CreditCard, LayoutDashboard, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { getStaffMobileConfig, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";
import { cn } from "@/lib/utils";

function isActive(pathname: string, route: string) {
  return route === "/church-admin" ? pathname.replace(/\/$/, "") === route : pathname === route || pathname.startsWith(`${route}/`);
}

export function ChurchAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, staffWorkspace } = useAuth();
  const billing = useBillingAccess();
  const workspaceConfig = getStaffMobileConfig(staffWorkspace);
  const workspaceLabel =
    staffWorkspace === "admin" ? "Church Admin Workspace" :
    staffWorkspace === "finance" ? "Finance Workspace" :
    staffWorkspace === "pastoral" ? "Pastoral Workspace" :
    staffWorkspace === "super_admin" ? "Super Admin Workspace" :
    "Staff Workspace";
  const { services, isLoading } = useVisibleStaffServices(workspaceConfig);
  const canOpenBilling = isStaffRouteAllowed(staffWorkspace, "/church-admin/billing");
  const churchName = profile?.church_name ?? profile?.church?.name ?? "Kanisa Connect";
  const groups = useMemo(() => {
    const result = new Map<string, typeof services>();
    for (const service of services) result.set(service.group, [...(result.get(service.group) ?? []), service]);
    return [...result.entries()];
  }, [services]);

  return (
    <Sidebar collapsible="icon" className="border-r border-white/[0.07] bg-[#090c11]/98 text-sidebar-foreground backdrop-blur-2xl">
      <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.09),transparent_24%)]">
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
          {!collapsed ? <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">Kanisa Connect</p><p className="mt-1 truncate text-sm font-semibold text-white">{churchName}</p><p className="truncate text-xs text-white/45">{workspaceLabel}</p></div> : null}
        </div>
        <SidebarContent className="premium-scrollbar px-3 py-4">
          <nav aria-label={workspaceLabel} className="space-y-5">
            <section className="space-y-1">
              {!collapsed ? <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Home</p> : null}
              <WorkspaceLink route="/church-admin" label="Dashboard" icon={LayoutDashboard} active={isActive(location.pathname, "/church-admin")} collapsed={collapsed} />
            </section>
            {isLoading ? <div className="mx-2 h-40 animate-pulse rounded-2xl bg-white/[0.04]" aria-label="Loading services" /> : null}
            {!isLoading ? groups.map(([group, items]) => <section key={group} className="space-y-1">
              {!collapsed ? <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{group}</p> : null}
              {items.map((service) => <WorkspaceLink key={service.id} route={service.route} label={service.label} icon={service.icon} active={isActive(location.pathname, service.route)} collapsed={collapsed} />)}
            </section>) : null}
          </nav>
        </SidebarContent>
        {canOpenBilling ? <div className="shrink-0 border-t border-white/[0.07] p-3">
          {!collapsed ? <div className={cn("rounded-2xl border p-3", billing.isExpired ? "border-amber-400/25 bg-amber-400/[0.07]" : "border-white/[0.08] bg-white/[0.03]")}>
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{billing.isExpired ? <LockKeyhole className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}</span><div className="min-w-0"><p className="text-xs font-semibold text-white">{billing.isLoading ? "Checking access…" : billing.isExpired ? "Workspace access limited" : `${billing.currentPlanDefinition.name} plan`}</p><p className="mt-1 text-[11px] leading-4 text-white/45">{billing.isExpired ? "Renew the parish subscription to restore approved services." : "Production feature access remains enforced."}</p><Link to="/church-admin/billing" className="mt-2 inline-block text-[11px] font-semibold text-primary">View billing</Link></div></div>
          </div> : <Link aria-label="View billing" to="/church-admin/billing" className="flex h-10 items-center justify-center rounded-xl text-primary hover:bg-primary/10"><CreditCard className="h-4 w-4" /></Link>}
        </div> : null}
      </div>
    </Sidebar>
  );
}

function WorkspaceLink({ route, label, icon: Icon, active, collapsed }: { route: string; label: string; icon: typeof LayoutDashboard; active: boolean; collapsed: boolean }) {
  return <Link to={route} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} data-navigation-item-id={route.split("/").filter(Boolean).at(-1) ?? "dashboard"} className={cn("group flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50", active ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]" : "text-white/55 hover:bg-white/[0.05] hover:text-white", collapsed && "justify-center px-0")}><Icon className="h-4 w-4 shrink-0" />{!collapsed ? <span className="truncate">{label}</span> : null}</Link>;
}
