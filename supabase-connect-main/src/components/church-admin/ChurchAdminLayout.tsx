import { Suspense, lazy } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChurchAdminSidebar } from "./ChurchAdminSidebar";
import { ChurchAdminCommandMenu } from "./ChurchAdminCommandMenu";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Bell, User, Lock, Building2, ChevronRight, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { getChurchAdminFeatureForPath } from "@/lib/church-admin-features";
import { Card, CardContent } from "@/components/ui/card";
import { StaffMobileBackHeader, StaffMobileBottomNav } from "@/components/staff-mobile/StaffMobileExperience";
import { STAFF_MOBILE_CONFIGS, canSuperAdminEnterChurchWorkspace, isStaffRouteAllowed } from "@/lib/staff-mobile-registry";

const FloatingAIAssistant = lazy(() =>
  import("./FloatingAIAssistant").then((module) => ({ default: module.FloatingAIAssistant })),
);

export function ChurchAdminLayout() {
  const { signOut, profile, isSuperAdmin, churchId, staffWorkspace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { getFeatureState, isLoading: featuresLoading } = useFeatureAccess();
  const isLegacySystemHealthPath = location.pathname === "/church-admin/system-health";
  const activeFeatureKey = getChurchAdminFeatureForPath(location.pathname);
  const activeFeatureState = activeFeatureKey ? getFeatureState(activeFeatureKey) : null;
  const routeHidden = !featuresLoading && activeFeatureKey && !activeFeatureState?.visible;
  const routeLocked = !featuresLoading && activeFeatureState?.locked;
  const mobileWorkspace = staffWorkspace === "admin" || staffWorkspace === "pastoral" || staffWorkspace === "finance" ? staffWorkspace : null;
  const mobileConfig = mobileWorkspace ? STAFF_MOBILE_CONFIGS[mobileWorkspace] : null;
  const routeDenied = isSuperAdmin
    ? !canSuperAdminEnterChurchWorkspace(churchId)
    : !isStaffRouteAllowed(staffWorkspace, location.pathname);
  const isHome = location.pathname.replace(/\/$/, "") === "/church-admin";
  const pageSegment = location.pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ") ?? "dashboard";
  const pageTitle = location.pathname.startsWith("/church-admin/event-requests")
    ? t("church_admin_layout.route_titles.event_requests")
    : pageSegment.replace(/\b\w/g, (character) => character.toUpperCase());
  const mobileTitle = pageTitle;
  const pageOwnsHeading = location.pathname.startsWith("/church-admin/event-requests");
  const workspaceLabel =
    staffWorkspace === "admin" ? t("church_admin_layout.workspaces.admin") :
    staffWorkspace === "finance" ? t("church_admin_layout.workspaces.finance") :
    staffWorkspace === "pastoral" ? t("church_admin_layout.workspaces.pastoral") :
    staffWorkspace === "super_admin" ? t("church_admin_layout.workspaces.super_admin") :
    t("church_admin_layout.workspaces.staff");
  const canOpenNotifications = isStaffRouteAllowed(staffWorkspace, "/church-admin/notifications");
  const canOpenSettings = isStaffRouteAllowed(staffWorkspace, "/church-admin/settings");

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ProtectedRoute requireChurch requireAdmin>
      {isLegacySystemHealthPath ? (
        <Navigate to={isSuperAdmin ? "/super-admin/system-health" : "/church-admin"} replace />
      ) : routeDenied ? (
        <Navigate to={mobileConfig?.home ?? "/portal/dashboard"} replace />
      ) : routeHidden ? (
        <Navigate to="/church-admin" replace />
      ) : (
      <SidebarProvider className="[--sidebar-width:15.25rem] [--sidebar-width-icon:4rem]">
        <div className="flex min-h-screen w-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.07),transparent_28%),hsl(var(--background))]">
          <div className="hidden lg:block">
            <ChurchAdminSidebar />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 hidden h-[76px] items-center gap-4 border-b border-white/[0.07] bg-background/88 px-5 backdrop-blur-xl lg:flex xl:px-7">
              <SidebarTrigger className="rounded-xl text-muted-foreground hover:bg-white/[0.05] hover:text-foreground" />
              <div className="flex min-w-0 items-center gap-3 border-l border-white/[0.08] pl-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{workspaceLabel}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="truncate">{profile?.church_name ?? profile?.church?.name ?? "Kanisa Connect"}</span><ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate text-foreground/70">{pageTitle}</span></div>
                </div>
              </div>
              <div className="ml-auto w-full max-w-sm xl:max-w-md">
                <ChurchAdminCommandMenu />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canOpenNotifications ? (
                  <Button aria-label={t("church_admin_layout.open_notifications")} variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:bg-white/[0.05] hover:text-foreground" onClick={() => navigate("/church-admin/notifications")}>
                    <Bell className="h-4 w-4" />
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label={t("church_admin_layout.open_profile")} variant="ghost" size="icon" className="rounded-xl hover:bg-white/[0.05]">
                      <div className="gradient-gold flex h-8 w-8 items-center justify-center rounded-xl">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[70] w-48">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">{profile?.full_name || "Admin"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {canOpenSettings ? (
                      <>
                        <DropdownMenuItem onClick={() => navigate("/church-admin/settings")}>{t("church_admin_layout.settings")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">{t("church_admin_layout.sign_out")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            {mobileConfig ? (
              <header className="sticky top-0 z-40 border-b border-border/60 bg-background/92 backdrop-blur-xl lg:hidden" data-testid="church-admin-mobile-profile-header">
                <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold font-serif text-foreground">Kanisa Connect</p>
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/75">{workspaceLabel}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label={t("church_admin_layout.open_profile")} variant="ghost" size="icon" className="shrink-0 rounded-full">
                        <div className="gradient-gold flex h-9 w-9 items-center justify-center rounded-full shadow-[0_14px_28px_-18px_rgba(250,204,21,0.65)]">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[70] w-64 max-w-[calc(100vw-2rem)]">
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">{profile?.full_name || "Admin"}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {canOpenSettings ? (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/church-admin/settings")}>{t("church_admin_layout.settings")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      ) : null}
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="mr-2 h-4 w-4" /> {t("church_admin_layout.sign_out")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
            ) : null}
            <main className="flex-1 overflow-auto px-4 pb-24 pt-5 lg:px-7 lg:pb-8 lg:pt-6 xl:px-9">
              {mobileConfig ? (
                <StaffMobileBackHeader
                  config={mobileConfig}
                  title={mobileTitle}
                  showTitle={!pageOwnsHeading}
                  ariaLabel={t("church_admin_layout.mobile_back_from", { title: mobileTitle })}
                />
              ) : null}
              {routeLocked ? (
                <div className="mx-auto max-w-2xl">
                  <Card className="glass-card border-primary/20">
                    <CardContent className="space-y-5 p-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h1 className="text-2xl font-bold font-serif">{t("shared.billing.admin_feature_locked_title")}</h1>
                        <p className="text-sm text-muted-foreground">
                          {t("shared.billing.admin_feature_locked_description")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  <div>
                    {!isHome && !pageOwnsHeading ? <div className="mx-auto mb-5 flex w-full max-w-[1600px] items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{workspaceLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1></div><p className="hidden text-sm text-muted-foreground md:block">{profile?.church_name ?? profile?.church?.name ?? t("church_admin_layout.parish_operations")}</p></div> : null}
                    <div className="mx-auto w-full max-w-[1600px]"><Outlet /></div>
                  </div>
                </>
              )}
            </main>
            <div className="hidden lg:block"><Suspense fallback={null}><FloatingAIAssistant /></Suspense></div>
            {mobileConfig ? <StaffMobileBottomNav config={mobileConfig} /> : null}
          </div>
        </div>
      </SidebarProvider>
      )}
    </ProtectedRoute>
  );
}
