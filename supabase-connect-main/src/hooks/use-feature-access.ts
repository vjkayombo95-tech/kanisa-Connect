import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type PlatformFeatureRow = {
  id: string;
  key: string;
  name: string;
  globally_enabled: boolean;
  globally_locked: boolean;
  available_plans?: string[];
};

type ChurchFeatureRow = {
  feature_id: string;
  enabled: boolean;
  locked?: boolean | null;
};

type RolePermissionRow = {
  feature_id: string;
  can_view: boolean;
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
  enabled: false,
  visible: false,
  locked: false,
});

export function useFeatureAccess() {
  const { churchId, isSuperAdmin, userRole } = useAuth();

  const { data: platformFeatures = [], isLoading: platformLoading } = useQuery({
    queryKey: ["portal-platform-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_features")
        .select("id, key, name, globally_enabled, globally_locked, available_plans");

      if (error) throw error;
      return (data ?? []) as PlatformFeatureRow[];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subscriptionPlan = null, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["feature-subscription-plan", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("church_id", churchId)
        .in("status", ["active", "trial"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.plan ?? null;
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rolePermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["church-role-permissions", churchId, userRole],
    queryFn: async () => {
      if (!churchId || !userRole || isSuperAdmin) return [];
      const { data, error } = await supabase
        .from("church_role_permissions")
        .select("feature_id, can_view")
        .eq("church_id", churchId)
        .eq("role", userRole);
      if (error) throw error;
      return (data ?? []) as RolePermissionRow[];
    },
    enabled: !!churchId && !!userRole && !isSuperAdmin,
    staleTime: 60 * 1000,
  });

  const { data: churchFeatures = [], isLoading: churchLoading } = useQuery({
    queryKey: ["portal-church-features", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data, error } = await supabase
        .from("church_features")
        .select("feature_id, enabled, locked")
        .eq("church_id", churchId);

      if (error) throw error;
      return (data ?? []) as ChurchFeatureRow[];
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const featureMap = useMemo(() => {
    const churchOverrides = new Map(churchFeatures.map((feature) => [feature.feature_id, feature]));
    const permissionMap = new Map(rolePermissions.map((permission) => [permission.feature_id, permission.can_view]));
    const result = new Map<string, FeatureState>();

    for (const feature of platformFeatures) {
      const globalEnabled = feature.globally_enabled;
      const globalLocked = feature.globally_locked;
      const subscriptionAvailable = subscriptionPlan !== null && feature.available_plans?.includes(subscriptionPlan) === true;
      const churchOverride = churchOverrides.get(feature.id);
      const churchEnabled = churchOverride?.enabled === true;
      const churchLocked = churchOverride?.locked === true;

      const roleCanView = isSuperAdmin || permissionMap.get(feature.id) === true;
      const visible = globalEnabled && subscriptionAvailable && churchEnabled && roleCanView;
      const locked = visible && (globalLocked || churchLocked);

      result.set(feature.key, {
        key: feature.key,
        exists: true,
        enabled: visible && !locked,
        visible,
        locked,
      });
    }

    return result;
  }, [churchFeatures, isSuperAdmin, platformFeatures, rolePermissions, subscriptionPlan]);

  const getFeatureState = useCallback((key: string): FeatureState => {
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
  }, [featureMap]);

  const isFeatureVisible = useCallback((key: string) => getFeatureState(key).visible, [getFeatureState]);
  const isFeatureLocked = useCallback((key: string) => getFeatureState(key).locked, [getFeatureState]);
  const isFeatureEnabled = useCallback((key: string) => getFeatureState(key).enabled, [getFeatureState]);

  return {
    isLoading: platformLoading || churchLoading || subscriptionLoading || permissionsLoading,
    platformFeatures,
    churchFeatures,
    getFeatureState,
    isFeatureVisible,
    isFeatureLocked,
    isFeatureEnabled,
  };
}
