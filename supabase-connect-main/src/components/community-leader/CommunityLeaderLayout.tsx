import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CommunityLeaderSidebar } from "./CommunityLeaderSidebar";
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useLedCommunities } from "@/hooks/use-community-leader";
import { Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CommunityOutletContext {
  communityId: string;
  community: any;
  leadershipRole: string;
  churchId: string;
}

export function CommunityLeaderLayout() {
  const { communityId } = useParams<{ communityId: string }>();
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const { data: ledCommunities, isLoading: loadingLed } = useLedCommunities();

  const leaderEntry = ledCommunities?.find((c) => c.community_id === communityId);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loadingLed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!leaderEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You are not a leader of this community.</p>
          <Button onClick={() => navigate("/portal")}>Back to Portal</Button>
        </div>
      </div>
    );
  }

  const context: CommunityOutletContext = {
    communityId: communityId!,
    community: leaderEntry ? { id: leaderEntry.community_id, name: leaderEntry.community_name } : null,
    leadershipRole: leaderEntry.leadership_role,
    churchId: leaderEntry.church_id,
  };

  return (
    <ProtectedRoute requireChurch>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <CommunityLeaderSidebar
            communityId={communityId!}
            communityName={leaderEntry.community_name || "Community"}
            leadershipRole={leaderEntry.leadership_role}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="flex items-center gap-2 flex-1">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {leaderEntry.leadership_role}
                </Badge>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {profile?.full_name || "Leader"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/portal")}>Member Portal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/portal/dashboard")}>My Dashboard</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
              <Outlet context={context} />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
