import type { ExplicitChurchFeatureResolution } from "@/hooks/use-feature-access";

export function shouldRenderUlizaKanisa(resolution: ExplicitChurchFeatureResolution) {
  return resolution === "enabled";
}
