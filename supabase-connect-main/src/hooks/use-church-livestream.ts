import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { churchLivestreamQueryKey, fetchMemberLivestream } from "@/lib/church-livestreams";

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
