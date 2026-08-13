import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { isAdminRole, type AppRole } from "@/lib/role-utils";
import { Button } from "@/components/ui/button";
import { isTransientAuthorizationFailure } from "@/lib/authorization-bootstrap";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireChurch?: boolean;
  requireAdmin?: boolean;
}

export function requireSuperAdminAccess(isSuperAdmin: boolean) {
  return isSuperAdmin;
}

export const requireSuperAdmin = requireSuperAdminAccess;

export function ProtectedRoute({ children, requireSuperAdmin, requireChurch, requireAdmin }: ProtectedRouteProps) {
  const { user, isSuperAdmin, churchId, userRole, isLoading, authorizationError, authorizationFailure, refreshUserData } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const redirectPath = `${location.pathname}${location.search}`;
    const params = new URLSearchParams({ redirect: redirectPath });
    if (location.pathname === "/onboarding") {
      params.set("mode", "signup");
    }
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (authorizationError) {
    const connectivity = authorizationFailure ? isTransientAuthorizationFailure(authorizationFailure) : false;
    return <div className="min-h-screen flex items-center justify-center bg-background p-4"><div className="max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm"><h1 className="text-xl font-semibold">{connectivity ? "We're having trouble connecting." : "We could not verify your workspace access."}</h1><p className="mt-2 text-sm text-muted-foreground">{connectivity ? "Your account is still signed in. Check your connection and try again." : "Your session is still signed in, but workspace access could not be verified."}</p><Button className="mt-5" onClick={() => void refreshUserData()}>Retry</Button></div></div>;
  }

  if (requireSuperAdmin && !requireSuperAdminAccess(isSuperAdmin)) return <Navigate to="/" replace />;

  if (requireAdmin && !isSuperAdmin && !isAdminRole(userRole as AppRole | null)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (requireChurch && !churchId && !isSuperAdmin) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
