import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnresolvedSystemLogCount() {
  return useQuery({
    queryKey: ["super-admin", "unresolved-system-log-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("app_error_logs" as never)
        .select("id", { count: "exact", head: true })
        .eq("resolved", false);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });
}
