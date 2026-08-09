import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { churchLivestreamQueryKey, fetchMemberLivestream, fetchMemberLivestreamById } from "@/lib/church-livestreams";

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
