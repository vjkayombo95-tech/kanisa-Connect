import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole, type AppRole } from "@/lib/role-utils";
import { getDefaultRouteForRole } from "@/lib/role-utils";
import { LoadingState } from "@/components/ui/page-state";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireChurch?: boolean;
  requireAdmin?: boolean;
  allowedRoles?: AppRole[];
}

export function requireSuperAdminAccess(isSuperAdmin: boolean) {
  return isSuperAdmin;
}

export const requireSuperAdmin = requireSuperAdminAccess;

export function ProtectedRoute({ children, requireSuperAdmin, requireChurch, requireAdmin, allowedRoles }: ProtectedRouteProps) {
  const { user, isSuperAdmin, churchId, userRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-5xl pt-16">
          <LoadingState variant="dashboard" title="Preparing your workspace" />
        </div>
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

  if (allowedRoles?.length && !isSuperAdmin && !allowedRoles.includes(userRole as AppRole)) {
    return <Navigate to={getDefaultRouteForRole(userRole as AppRole | null, isSuperAdmin)} replace />;
  }

  if (requireChurch && !churchId && !isSuperAdmin) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
