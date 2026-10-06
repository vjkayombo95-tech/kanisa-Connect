import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useFeatureAccess } from "@/hooks/use-feature-access";
import { shouldRenderUlizaKanisa } from "@/lib/uliza-feature-gate";

export function UlizaKanisaFeatureGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { getExplicitChurchFeatureResolution } = useFeatureAccess();
  const resolution = getExplicitChurchFeatureResolution("kanisa_ai");

  if (resolution === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">{t("member_assistant.loading_service")}</div>;
  }

  if (!shouldRenderUlizaKanisa(resolution)) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
