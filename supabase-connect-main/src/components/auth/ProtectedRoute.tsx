import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasAnyRole, isAdminRoles, type AppRole } from "@/lib/role-utils";
import { getDefaultRouteForRoles } from "@/lib/role-utils";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { shouldRedirectToMemberOnboarding } from "@/lib/authorization-readiness";
import { AuthorizationBootstrapError, isTransientAuthorizationFailure } from "@/lib/authorization-bootstrap";

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
  const {
    user,
    isSuperAdmin,
    churchId,
    userRoles,
    isLoading,
    authorizationReady,
    authorizationError,
    refreshUserData,
  } = useAuth();
  const location = useLocation();

  if (authorizationError) {
    const isConnectivityFailure = authorizationError instanceof AuthorizationBootstrapError
      && isTransientAuthorizationFailure(authorizationError.classification);
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl pt-16">
          <ErrorState
            title={isConnectivityFailure ? "We're having trouble connecting." : "We could not verify your workspace access."}
            description={isConnectivityFailure
              ? "Your account is still signed in. Check your connection and try again."
              : "Your session is still signed in, but membership and permissions could not be loaded. Retry before continuing."}
            onRetry={() => void refreshUserData()}
          />
        </div>
      </div>
    );
  }

  if (isLoading || !authorizationReady) {
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

  if (requireAdmin && !isSuperAdmin && !isAdminRoles(userRoles)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (allowedRoles?.length && !isSuperAdmin && !hasAnyRole(userRoles, allowedRoles)) {
    return <Navigate to={getDefaultRouteForRoles(userRoles, isSuperAdmin)} replace />;
  }

  if (requireChurch && shouldRedirectToMemberOnboarding({
    authorizationReady,
    authenticated: Boolean(user),
    isSuperAdmin,
    churchId,
  })) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
