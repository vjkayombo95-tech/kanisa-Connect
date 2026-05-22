import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { isAdminRole, type AppRole } from "@/lib/role-utils";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireChurch?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireSuperAdmin, requireChurch, requireAdmin }: ProtectedRouteProps) {
  const { user, isSuperAdmin, churchId, userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" replace />;

  if (requireAdmin && !isSuperAdmin && !isAdminRole(userRole as AppRole | null)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  if (requireChurch && !churchId && !isSuperAdmin) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
