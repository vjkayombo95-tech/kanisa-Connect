import { Building2, CreditCard, LayoutDashboard, LockKeyhole, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { translateStaffServiceLabel } from "@/lib/localization";
import { getStaffMobileConfig, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";
import { cn } from "@/lib/utils";

const PRIMARY_SERVICE_IDS = new Set([
  "members",
  "contributions",
  "mass-intentions",
  "announcements",
  "mass-timetable",
]);

function isActive(pathname: string, route: string) {
  return route === "/church-admin"
    ? pathname.replace(/\/$/, "") === route
    : pathname === route || pathname.startsWith(`${route}/`);
}

export function ChurchAdminSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, staffWorkspace } = useAuth();
  const billing = useBillingAccess();
  const workspaceConfig = getStaffMobileConfig(staffWorkspace);

  const workspaceLabel =
    staffWorkspace === "admin"
      ? t("church_admin_layout.workspaces.admin")
      : staffWorkspace === "finance"
        ? t("church_admin_layout.workspaces.finance")
        : staffWorkspace === "pastoral"
          ? t("church_admin_layout.workspaces.pastoral")
          : staffWorkspace === "super_admin"
            ? t("church_admin_layout.workspaces.super_admin")
            : t("church_admin_layout.workspaces.staff");

  const { services, isLoading } = useVisibleStaffServices(workspaceConfig);
  const canOpenBilling = isStaffRouteAllowed(staffWorkspace, "/church-admin/billing");
  const churchName = profile?.church_name ?? profile?.church?.name ?? "Kanisa Connect";

  const primaryServices = services.filter((service) =>
    PRIMARY_SERVICE_IDS.has(service.id),
  );

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-white/[0.07] bg-[#090c11]/98 text-sidebar-foreground backdrop-blur-2xl"
    >
      <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.09),transparent_24%)]">
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/[0.07] px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>

          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">
                Kanisa Connect
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {churchName}
              </p>
              <p className="truncate text-xs text-white/45">{workspaceLabel}</p>
            </div>
          ) : null}
        </div>

        <SidebarContent className="premium-scrollbar px-3 py-4">
          <nav aria-label={workspaceLabel} className="space-y-1">
            <WorkspaceLink
              route="/church-admin"
              label={t("nav.home")}
              icon={LayoutDashboard}
              active={isActive(location.pathname, "/church-admin")}
              collapsed={collapsed}
            />

            {isLoading ? (
              <div
                className="mx-2 mt-3 h-32 animate-pulse rounded-2xl bg-white/[0.04]"
                aria-label={t("staff_mobile.loading_services")}
              />
            ) : null}

            {!isLoading
              ? primaryServices.map((service) => (
                  <WorkspaceLink
                    key={service.id}
                    route={service.route}
                    label={translateStaffServiceLabel(t, service)}
                    icon={service.icon}
                    active={isActive(location.pathname, service.route)}
                    collapsed={collapsed}
                  />
                ))
              : null}

            {!isLoading && workspaceConfig ? (
              <WorkspaceLink
                route="/church-admin/services"
                label={t("nav.more")}
                icon={MoreHorizontal}
                active={isActive(location.pathname, "/church-admin/services")}
                collapsed={collapsed}
              />
            ) : null}
          </nav>
        </SidebarContent>

        {canOpenBilling ? (
          <div className="shrink-0 border-t border-white/[0.07] p-3">
            {!collapsed ? (
              <div
                className={cn(
                  "rounded-2xl border p-3",
                  billing.isExpired
                    ? "border-amber-400/25 bg-amber-400/[0.07]"
                    : "border-white/[0.08] bg-white/[0.03]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {billing.isExpired ? (
                      <LockKeyhole className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">
                      {billing.isLoading
                        ? t("church_admin_shell.sidebar.checking_access")
                        : billing.isExpired
                          ? t("church_admin_shell.sidebar.workspace_access_limited")
                          : t("church_admin_shell.sidebar.current_plan", { plan: billing.currentPlanDefinition.name })}
                    </p>

                    <p className="mt-1 text-[11px] leading-4 text-white/45">
                      {billing.isExpired
                        ? t("church_admin_shell.sidebar.renew_subscription")
                        : t("church_admin_shell.sidebar.feature_access_enforced")}
                    </p>

                    <Link
                      to="/church-admin/billing"
                      className="mt-2 inline-block text-[11px] font-semibold text-primary"
                    >
                      {t("church_admin_shell.sidebar.view_billing")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                aria-label={t("church_admin_shell.sidebar.view_billing")}
                to="/church-admin/billing"
                className="flex h-10 items-center justify-center rounded-xl text-primary hover:bg-primary/10"
              >
                <CreditCard className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </Sidebar>
  );
}

function WorkspaceLink({
  route,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  route: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={route}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      data-navigation-item-id={
        route.split("/").filter(Boolean).at(-1) ?? "dashboard"
      }
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]"
          : "text-white/60 hover:bg-white/[0.05] hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}
