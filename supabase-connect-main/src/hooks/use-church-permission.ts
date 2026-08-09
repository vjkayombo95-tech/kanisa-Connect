import { useQuery } from "@tanstack/react-query";

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
