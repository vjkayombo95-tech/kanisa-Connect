import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { fetchMemberRadioStations } from "@/lib/church-radio";
import { supabase } from "@/integrations/supabase/client";

export function useRadioPermission(action:"view"|"manage") {
  const { churchId, user } = useAuth();
  const features = useFeatureAccess();
  const feature = features.getFeatureState("radio");
  return useQuery({ queryKey:["production-radio-permission", action, user?.id, churchId], queryFn:async()=>{
    const { data, error } = await supabase.rpc("has_radio_permission" as never, { _user_id:user!.id, _church_id:churchId!, _action:action } as never);
    if (error) throw error;
    return data === true;
  }, enabled:!!user && !!churchId && !features.isLoading && feature.exists && feature.visible, staleTime:30_000 });
}

export function useChurchRadioStations() {
  const { churchId } = useAuth();
  const features = useFeatureAccess();
  const permission = useRadioPermission("view");
  const feature = features.getFeatureState("radio");
  const enabled = !features.isLoading && feature.exists && feature.visible && permission.data === true;
  const query = useQuery({ queryKey:["production-radio-stations", churchId], queryFn:()=>fetchMemberRadioStations(churchId!), enabled:!!churchId && !features.isLoading && !permission.isLoading && enabled, staleTime:60_000 });
  return { ...query, data:enabled ? query.data ?? [] : [], featureEnabled:enabled, featureLoading:features.isLoading || permission.isLoading, churchId };
}
