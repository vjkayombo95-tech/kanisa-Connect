import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchMemberRadioStations } from "@/lib/church-radio";

export function useChurchRadioStations() {
  const { churchId } = useAuth();
  const { getFeatureState, isLoading: featureLoading } = useFeatureAccess();
  const feature = getFeatureState("radio");
  const query = useQuery({ queryKey: ["church-radio-stations", churchId, "member"], queryFn: () => fetchMemberRadioStations(churchId!), enabled: !!churchId && !featureLoading && feature.visible, staleTime: 60_000 });
  return { ...query, data: feature.visible ? query.data ?? [] : [], featureEnabled: feature.visible, featureLoading, churchId };
}
