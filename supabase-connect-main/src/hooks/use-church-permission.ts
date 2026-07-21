import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type ChurchPermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "publish" | "manage";

export function useChurchPermission(featureKey: string, action: ChurchPermissionAction = "view") {
  const { churchId, user } = useAuth();
  const query = useQuery({
    queryKey: ["church-permission", churchId, user?.id, featureKey, action],
    queryFn: async () => {
      if (!churchId || !user?.id) return false;
      const { data, error } = await supabase.rpc("has_church_feature_permission", {
        _user_id: user.id,
        _church_id: churchId,
        _feature_key: featureKey,
        _action: action,
      });
      if (error) throw error;
      return data === true;
    },
    enabled: !!churchId && !!user?.id && !!featureKey,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
  });

  return { allowed: query.data === true, isLoading: query.isLoading, error: query.error };
}

export function usePermissionCacheInvalidation() {
  const { churchId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!churchId) return;
    const invalidate = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["church-permission", churchId] }),
        queryClient.invalidateQueries({ queryKey: ["church-feature-permission-matrix", churchId] }),
        queryClient.invalidateQueries({ queryKey: ["church-role-permissions", churchId] }),
        queryClient.invalidateQueries({ queryKey: ["portal-church-features", churchId] }),
      ]);
    };
    const channel = supabase
      .channel(`permission-cache:${churchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "church_features", filter: `church_id=eq.${churchId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "church_role_permissions", filter: `church_id=eq.${churchId}` }, invalidate)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [churchId, queryClient]);
}
