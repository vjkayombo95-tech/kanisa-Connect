import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type PlatformFeatureRow = {
  id: string;
  key: string;
  name: string;
  globally_enabled: boolean;
  globally_locked: boolean;
};

type ChurchFeatureRow = {
  feature_id: string;
  enabled: boolean;
};

const FEATURE_KEY_ALIASES: Record<string, string[]> = {
  give: ["contributions"],
  contributions: ["give"],
};

export type FeatureState = {
  key: string;
  exists: boolean;
  enabled: boolean;
  visible: boolean;
  locked: boolean;
};

const DEFAULT_FEATURE_STATE = (key: string): FeatureState => ({
  key,
  exists: false,
  enabled: true,
  visible: true,
  locked: false,
});

export function useFeatureAccess() {
  const { churchId } = useAuth();

  const { data: platformFeatures = [], isLoading: platformLoading } = useQuery({
    queryKey: ["portal-platform-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_features")
        .select("id, key, name, globally_enabled, globally_locked");

      if (error) throw error;
      return (data ?? []) as PlatformFeatureRow[];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: churchFeatures = [], isLoading: churchLoading } = useQuery({
    queryKey: ["portal-church-features", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data, error } = await supabase
        .from("church_features")
        .select("feature_id, enabled")
        .eq("church_id", churchId);

      if (error) throw error;
      return (data ?? []) as ChurchFeatureRow[];
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const featureMap = useMemo(() => {
    const churchOverrides = new Map(churchFeatures.map((feature) => [feature.feature_id, feature.enabled]));
    const result = new Map<string, FeatureState>();

    for (const feature of platformFeatures) {
      const globalEnabled = feature.globally_enabled;
      const globalLocked = feature.globally_locked;
      const churchEnabled = churchOverrides.has(feature.id)
        ? churchOverrides.get(feature.id) ?? globalEnabled
        : globalEnabled;

      const visible = globalEnabled && (globalLocked || churchEnabled);
      const locked = globalEnabled && globalLocked;

      result.set(feature.key, {
        key: feature.key,
        exists: true,
        enabled: visible && !locked,
        visible,
        locked,
      });
    }

    return result;
  }, [churchFeatures, platformFeatures]);

  const getFeatureState = (key: string): FeatureState => {
    const directState = featureMap.get(key);
    if (directState) return directState;

    const aliases = FEATURE_KEY_ALIASES[key] ?? [];
    for (const alias of aliases) {
      const aliasState = featureMap.get(alias);
      if (aliasState) {
        return {
          ...aliasState,
          key,
        };
      }
    }

    return DEFAULT_FEATURE_STATE(key);
  };

  return {
    isLoading: platformLoading || churchLoading,
    platformFeatures,
    churchFeatures,
    getFeatureState,
    isFeatureVisible: (key: string) => getFeatureState(key).visible,
    isFeatureLocked: (key: string) => getFeatureState(key).locked,
    isFeatureEnabled: (key: string) => getFeatureState(key).enabled,
  };
}
