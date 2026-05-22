import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChurchAdminSidebar } from "./ChurchAdminSidebar";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell, User, Lock } from "lucide-react";
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
import { FloatingAIAssistant } from "./FloatingAIAssistant";

export function ChurchAdminLayout() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getFeatureState, isLoading: featuresLoading } = useFeatureAccess();
  const activeFeatureKey = getChurchAdminFeatureForPath(location.pathname);
  const activeFeatureState = activeFeatureKey ? getFeatureState(activeFeatureKey) : null;
  const routeHidden = !featuresLoading && activeFeatureKey && !activeFeatureState?.visible;
  const routeLocked = !featuresLoading && activeFeatureState?.locked;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ProtectedRoute requireChurch requireAdmin>
      {routeHidden ? (
        <Navigate to="/church-admin" replace />
      ) : (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <ChurchAdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9 bg-secondary border-border/50 h-9" />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/church-admin/notifications")}>
                  <Bell className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[70] w-48">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">{profile?.full_name || "Admin"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/church-admin/settings")}>Church Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
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
                <Outlet />
              )}
            </main>
            <FloatingAIAssistant />
          </div>
        </div>
      </SidebarProvider>
      )}
    </ProtectedRoute>
  );
}
