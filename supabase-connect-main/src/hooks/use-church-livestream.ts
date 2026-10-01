import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { churchLivestreamQueryKey, fetchMemberLivestream, fetchMemberLivestreamById } from "@/lib/church-livestreams";

import { supabase } from "@/integrations/supabase/client";
export function useChurchLivestream(includeRecording = false) {
  const { churchId } = useAuth();
  const { getFeatureState, isLoading: featureLoading } = useFeatureAccess();
  const feature = getFeatureState("livestream");
  const query = useQuery({
    queryKey: [...churchLivestreamQueryKey(churchId), "member", includeRecording],
    queryFn: () => fetchMemberLivestream(churchId!, includeRecording),
    enabled: !!churchId && !featureLoading && feature.visible,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  return { ...query, data: feature.visible ? query.data ?? null : null, featureEnabled: feature.visible, churchId };
}

export function useMemberLivestream(streamId: string | undefined) {
  const { churchId } = useAuth();
  const { getFeatureState, isLoading: featureLoading } = useFeatureAccess();
  const feature = getFeatureState("livestream");
  const query = useQuery({
    queryKey: [...churchLivestreamQueryKey(churchId), "member-viewer", streamId],
    queryFn: () => fetchMemberLivestreamById(churchId!, streamId!),
    enabled: !!churchId && !!streamId && !featureLoading && feature.visible,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });

  return {
    ...query,
    data: feature.visible ? query.data ?? null : null,
    featureEnabled: feature.visible,
    featureLoading,
    churchId,
  };
}

export function useLivestreamPermission(
  action: "view" | "create" | "edit" | "delete" | "manage",
  enabled = true,
) {
  const { churchId, user } = useAuth();

  return useQuery({
    queryKey: ["production-livestream-permission", action, user?.id, churchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "has_livestream_permission" as never,
        {
          _user_id: user!.id,
          _church_id: churchId!,
          _action: action,
        } as never,
      );

      if (error) throw error;
      return data === true;
    },
    enabled: !!user && !!churchId && enabled,
    staleTime: 30_000,
  });
}
