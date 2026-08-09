import type { ReactNode } from "react";

import { useChurchPermission, type ChurchPermissionAction } from "@/hooks/use-church-permission";

type ChurchPermissionGateProps = {
  feature: string;
  action: ChurchPermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
};

/** UX gate only. Database policies/RPC checks remain the security boundary. */
export function ChurchPermissionGate({ feature, action, children, fallback = null }: ChurchPermissionGateProps) {
  const { allowed, isLoading } = useChurchPermission(feature, action);
  if (isLoading || !allowed) return <>{fallback}</>;
  return <>{children}</>;
}
