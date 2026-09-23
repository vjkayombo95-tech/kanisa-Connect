import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { isAdminRole, type AppRole } from "@/lib/role-utils";
import { Button } from "@/components/ui/button";
import { isTransientAuthorizationFailure } from "@/lib/authorization-bootstrap";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label={t("shared.loading.checking_access")}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">{t("shared.loading.checking_access")}</span>
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
    return <div className="min-h-screen flex items-center justify-center bg-background p-4"><div className="max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm"><h1 className="text-xl font-semibold">{connectivity ? t("shared.auth.connectivity_title") : t("shared.auth.workspace_access_title")}</h1><p className="mt-2 text-sm text-muted-foreground">{connectivity ? t("shared.auth.connectivity_description") : t("shared.auth.workspace_access_description")}</p><Button className="mt-5" onClick={() => void refreshUserData()}>{t("shared.actions.retry")}</Button></div></div>;
  }

  if (requireSuperAdmin && !requireSuperAdminAccess(isSuperAdmin)) return <Navigate to="/" replace />;

  if (requireAdmin && !isSuperAdmin && !isAdminRole(userRole as AppRole | null)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (requireChurch && !churchId && !isSuperAdmin) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
