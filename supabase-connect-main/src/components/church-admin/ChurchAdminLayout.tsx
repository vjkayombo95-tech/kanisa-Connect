import { Suspense, lazy } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChurchAdminSidebar } from "./ChurchAdminSidebar";
import { ChurchAdminCommandMenu } from "./ChurchAdminCommandMenu";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, User, Lock, Building2, ChevronRight } from "lucide-react";
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
  const mobileTitle = pageSegment;
  const pageTitle = pageSegment.replace(/\b\w/g, (character) => character.toUpperCase());
  const workspaceLabel =
    staffWorkspace === "admin" ? "Church Admin Workspace" :
    staffWorkspace === "finance" ? "Finance Workspace" :
    staffWorkspace === "pastoral" ? "Pastoral Workspace" :
    staffWorkspace === "super_admin" ? "Super Admin Workspace" :
    "Staff Workspace";
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
                  <Button aria-label="Fungua arifa" variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:bg-white/[0.05] hover:text-foreground" onClick={() => navigate("/church-admin/notifications")}>
                    <Bell className="h-4 w-4" />
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="Fungua wasifu" variant="ghost" size="icon" className="rounded-xl hover:bg-white/[0.05]">
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
                        <DropdownMenuItem onClick={() => navigate("/church-admin/settings")}>Church Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 overflow-auto px-4 pb-24 pt-5 lg:px-7 lg:pb-8 lg:pt-6 xl:px-9">
              {mobileConfig ? <StaffMobileBackHeader config={mobileConfig} title={mobileTitle} /> : null}
              {routeLocked ? (
                <div className="mx-auto max-w-2xl">
                  <Card className="glass-card border-primary/20">
                    <CardContent className="space-y-5 p-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h1 className="text-2xl font-bold font-serif">This admin feature is locked</h1>
                        <p className="text-sm text-muted-foreground">
                          The super admin has locked this feature for church admins.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
                  <div>
                    {!isHome ? <div className="mx-auto mb-5 flex w-full max-w-[1600px] items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{workspaceLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1></div><p className="hidden text-sm text-muted-foreground md:block">{profile?.church_name ?? profile?.church?.name ?? "Parish operations"}</p></div> : null}
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
