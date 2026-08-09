import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Shield } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useUnresolvedSystemLogCount } from "@/hooks/use-system-log-alert";
import { SuperAdminSearch } from "./SuperAdminSearch";

const pageTitles: Array<{ match: string; title: string; description: string }> = [
  { match: "/super-admin/settings", title: "Platform Settings", description: "Control platform-wide behavior" },
  { match: "/super-admin/churches", title: "Church Management", description: "Review and manage church workspaces" },
  { match: "/super-admin/subscriptions", title: "Subscriptions", description: "Monitor plans, billing, and renewals" },
  { match: "/super-admin/record-preservation", title: "Record Preservation", description: "Review platform record preservation payments" },
  { match: "/super-admin/features", title: "Feature Management", description: "Enable and control platform features" },
  { match: "/super-admin/revenue", title: "Revenue Analytics", description: "Track growth and platform revenue" },
  { match: "/super-admin/system-health", title: "System Health", description: "Monitor platform automation health and delivery activity" },
  { match: "/super-admin/system-jobs/", title: "Job Details", description: "Inspect scheduled job status, runs, and alerts" },
  { match: "/super-admin/system-jobs", title: "Scheduled Jobs", description: "Manage and monitor scheduled platform jobs" },
  { match: "/super-admin/job-history", title: "Job History", description: "View execution history for scheduled platform jobs" },
  { match: "/super-admin/system-logs", title: "System Logs", description: "Inspect platform error monitoring and app issues" },
  { match: "/super-admin/audit-logs", title: "Audit Logs", description: "Track system and administrator activity" },
  { match: "/super-admin/logs", title: "Platform Activity", description: "Inspect platform activity and audit events" },
  { match: "/super-admin/activity", title: "User Activity", description: "Review admin and user actions" },
  { match: "/super-admin", title: "Platform Dashboard", description: "Overview of the Kanisa Connect platform" },
];

export function SuperAdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: unresolvedSystemLogCount = 0 } = useUnresolvedSystemLogCount();
  const hasUnresolvedSystemLogs = unresolvedSystemLogCount > 0;

  const currentPage =
    pageTitles.find((page) => {
      const childMatch = page.match.endsWith("/") ? page.match : `${page.match}/`;
      return location.pathname === page.match || location.pathname.startsWith(childMatch);
    }) ??
    pageTitles[pageTitles.length - 1];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ProtectedRoute requireSuperAdmin>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <SuperAdminSidebar />
          <div className="flex-1 flex min-w-0 flex-col">
            <header className="sticky top-0 z-10 border-b border-border bg-card/70 backdrop-blur-xl">
              <div className="px-3 py-3 sm:px-4 sm:py-0">
                <div className="flex min-h-14 items-start gap-3 sm:items-center">
                  <SidebarTrigger className="mt-1 h-9 w-9 shrink-0 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground sm:mt-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 sm:hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-gold">
                        <Shield className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{currentPage.title}</p>
                        <p className="truncate text-xs text-muted-foreground">Super Admin Workspace</p>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <SuperAdminSearch className="max-w-md" />
                    </div>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                      onClick={() => navigate("/super-admin/system-logs")}
                    >
                      <Bell className="h-4 w-4" />
                      {hasUnresolvedSystemLogs && (
                        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-gold">
                            <Shield className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>Platform Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">Sign Out</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-3 space-y-3 sm:hidden">
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">{currentPage.title}</h1>
                    <p className="text-sm text-muted-foreground">{currentPage.description}</p>
                  </div>
                  <SuperAdminSearch />
                </div>

                <div className="hidden min-h-14 items-center gap-4 sm:flex">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{currentPage.title}</p>
                    <p className="text-xs text-muted-foreground">{currentPage.description}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative text-muted-foreground hover:text-foreground"
                      onClick={() => navigate("/super-admin/system-logs")}
                    >
                      <Bell className="h-4 w-4" />
                      {hasUnresolvedSystemLogs && (
                        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center">
                            <Shield className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>Platform Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">Sign Out</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-auto px-3 py-4 sm:p-6">
              <div className="mx-auto w-full max-w-7xl">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
