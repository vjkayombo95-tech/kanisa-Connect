import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell, Shield } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const pageTitles: Array<{ match: string; title: string; description: string }> = [
  { match: "/super-admin/settings", title: "Platform Settings", description: "Control platform-wide behavior" },
  { match: "/super-admin/churches", title: "Church Management", description: "Review and manage church workspaces" },
  { match: "/super-admin/subscriptions", title: "Subscriptions", description: "Monitor plans, billing, and renewals" },
  { match: "/super-admin/features", title: "Feature Management", description: "Enable and control platform features" },
  { match: "/super-admin/revenue", title: "Revenue Analytics", description: "Track growth and platform revenue" },
  { match: "/super-admin/logs", title: "System Logs", description: "Inspect system activity and issues" },
  { match: "/super-admin/activity", title: "User Activity", description: "Review admin and user actions" },
  { match: "/super-admin", title: "Platform Dashboard", description: "Overview of the Kanisa Connect platform" },
];

export function SuperAdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage =
    pageTitles.find((page) => location.pathname === page.match || location.pathname.startsWith(`${page.match}/`)) ??
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
                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search platform..." className="h-9 border-border/50 bg-secondary pl-9" />
                      </div>
                    </div>
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground">
                      <Bell className="h-4 w-4" />
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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search platform..." className="h-10 rounded-xl border-border/50 bg-secondary pl-9" />
                  </div>
                </div>

                <div className="hidden min-h-14 items-center gap-4 sm:flex">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{currentPage.title}</p>
                    <p className="text-xs text-muted-foreground">{currentPage.description}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <Bell className="h-4 w-4" />
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
