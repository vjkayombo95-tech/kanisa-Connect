import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { isAdminRole, type AppRole } from "@/lib/role-utils";

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
  const { user, isSuperAdmin, churchId, userRole, isLoading } = useAuth();
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

  if (requireSuperAdmin && !requireSuperAdminAccess(isSuperAdmin)) return <Navigate to="/" replace />;

  if (requireAdmin && !isSuperAdmin && !isAdminRole(userRole as AppRole | null)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (requireChurch && !churchId && !isSuperAdmin) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
