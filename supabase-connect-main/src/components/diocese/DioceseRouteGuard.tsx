import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  findDioceseWorkspace,
  getMyDioceseWorkspaces,
} from "@/lib/diocese-workspace";
import { useTranslation } from "react-i18next";
import { DioceseWorkspaceProvider } from "@/components/diocese/DioceseWorkspaceContext";

interface DioceseRouteGuardProps {
  children: ReactNode;
}

export function DioceseRouteGuard({ children }: DioceseRouteGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { dioceseId } = useParams<{ dioceseId: string }>();
  const location = useLocation();
  const { t } = useTranslation();

  const workspaceQuery = useQuery({
    queryKey: ["diocese-workspaces", user?.id],
    queryFn: getMyDioceseWorkspaces,
    enabled: Boolean(user) && !authLoading,
    staleTime: 60_000,
    retry: 1,
  });

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-label={t("shared.loading.checking_access")}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">{t("shared.loading.checking_access")}</span>
      </div>
    );
  }

  if (!user) {
    const redirectPath = `${location.pathname}${location.search}`;
    const params = new URLSearchParams({ redirect: redirectPath });

    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  if (workspaceQuery.isPending) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-label={t("shared.loading.checking_access")}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">{t("shared.loading.checking_access")}</span>
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-lg rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">
            {t("shared.auth.workspace_access_title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("shared.auth.workspace_access_description")}
          </p>
          <Button
            className="mt-5"
            onClick={() => void workspaceQuery.refetch()}
          >
            {t("shared.actions.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const workspace = findDioceseWorkspace(
    workspaceQuery.data ?? [],
    dioceseId,
  );

  if (!workspace) {
    return <Navigate to="/" replace />;
  }

  return (
    <DioceseWorkspaceProvider workspace={workspace}>
      {children}
    </DioceseWorkspaceProvider>
  );
}
