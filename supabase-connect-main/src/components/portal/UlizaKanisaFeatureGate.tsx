import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useFeatureAccess } from "@/hooks/use-feature-access";
import { shouldRenderUlizaKanisa } from "@/lib/uliza-feature-gate";

export function UlizaKanisaFeatureGate({ children }: { children: ReactNode }) {
  const { getExplicitChurchFeatureResolution } = useFeatureAccess();
  const resolution = getExplicitChurchFeatureResolution("kanisa_ai");

  if (resolution === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Inapakia huduma...</div>;
  }

  if (!shouldRenderUlizaKanisa(resolution)) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
