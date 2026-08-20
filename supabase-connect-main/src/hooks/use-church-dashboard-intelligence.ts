import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  canRequestFinancialSummary,
  canRequestPendingCounts,
  normalizeFinancialSummary,
  normalizePendingCounts,
} from "@/lib/church-dashboard-intelligence";

export function useChurchDashboardIntelligence() {
  const { authorizationReady, churchId, isSuperAdmin, staffWorkspace, user, userRole } = useAuth();
  const identityReady = authorizationReady && !!churchId && !!user?.id;
  const pendingEnabled = identityReady && canRequestPendingCounts(staffWorkspace);
  const financialEnabled = identityReady && canRequestFinancialSummary(userRole, isSuperAdmin);

  const pending = useQuery({
    queryKey: ["production-dashboard-pending", user?.id, churchId],
    queryFn: async ({ signal }) => {
      if (!churchId) throw new Error("Church context is required");
      const { data, error } = await supabase
        .rpc("get_church_admin_pending_counts" as never, { _church_id: churchId } as never)
        .abortSignal(signal);
      if (error) throw error;
      return normalizePendingCounts(data);
    },
    enabled: pendingEnabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const financial = useQuery({
    queryKey: ["production-dashboard-financial", user?.id, churchId],
    queryFn: async ({ signal }) => {
      if (!churchId) throw new Error("Church context is required");
      const { data, error } = await supabase.rpc("get_church_financial_summary" as never, {
        _church_id: churchId,
        _start_date: null,
        _end_date: null,
      } as never).abortSignal(signal);
      if (error) throw error;
      return normalizeFinancialSummary(data);
    },
    enabled: financialEnabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return { pending, pendingEnabled, financial, financialEnabled, staffWorkspace };
}
