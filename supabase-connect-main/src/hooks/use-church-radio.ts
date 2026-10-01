import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchMemberRadioStations } from "@/lib/church-radio";

import { supabase } from "@/integrations/supabase/client";
export function useChurchRadioStations() {
  const { churchId } = useAuth();
  const { getFeatureState, isLoading: featureLoading } = useFeatureAccess();
  const feature = getFeatureState("radio");
  const query = useQuery({ queryKey: ["church-radio-stations", churchId, "member"], queryFn: () => fetchMemberRadioStations(churchId!), enabled: !!churchId && !featureLoading && feature.visible, staleTime: 60_000 });
  return { ...query, data: feature.visible ? query.data ?? [] : [], featureEnabled: feature.visible, featureLoading, churchId };
}

export function useRadioPermission(action: "view" | "manage") {
  const { churchId, user } = useAuth();
  const features = useFeatureAccess();
  const feature = features.getFeatureState("radio");

  return useQuery({
    queryKey: ["production-radio-permission", action, user?.id, churchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "has_radio_permission" as never,
        {
          _user_id: user!.id,
          _church_id: churchId!,
          _action: action,
        } as never,
      );

      if (error) throw error;
      return data === true;
    },
    enabled:
      !!user &&
      !!churchId &&
      features.isResolved &&
      feature.exists &&
      feature.visible,
    staleTime: 30_000,
  });
}
