import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyErrorMessage, logSupabaseError } from "@/lib/error-logger";

/**
 * Hook for church-scoped data queries.
 * Automatically filters by the current user's church_id.
 */
export function useChurchQuery<T = any>(
  table: string,
  options?: {
    queryKey?: string[];
    select?: string;
    orderBy?: string;
    ascending?: boolean;
    filters?: Record<string, any>;
    enabled?: boolean;
  }
) {
  const { churchId } = useAuth();
  const key = options?.queryKey ?? [`church-${table}`];

  return useQuery({
    queryKey: [...key, churchId],
    queryFn: async () => {
      if (!churchId) return [] as T[];
      let query = supabase
        .from(table as any)
        .select(options?.select ?? "*")
        .eq("church_id", churchId);

      if (options?.filters) {
        Object.entries(options.filters).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        logSupabaseError(error, {
          function: "useChurchQuery",
          operation: "select",
          table,
          church_id: churchId,
        });
        return [] as T[];
      }
      return (data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!churchId,
  });
}

/**
 * Hook for church-scoped count queries.
 */
export function useChurchCount(
  table: string,
  filters?: Record<string, any>
) {
  const { churchId } = useAuth();

  return useQuery({
    queryKey: [`church-${table}-count`, churchId, filters],
    queryFn: async () => {
      if (!churchId) return 0;
      let query = supabase
        .from(table as any)
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId);

      if (filters) {
        Object.entries(filters).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
      }

      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!churchId,
  });
}

/**
 * Hook for church-scoped mutations (insert).
 */
export function useChurchInsert(table: string) {
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!churchId) throw new Error("No church context");
      const { data: result, error } = await supabase
        .from(table as any)
        .insert({ ...data, church_id: churchId })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`church-${table}`] });
    },
    onError: (err: any) => {
      logSupabaseError(err, { function: "useChurchInsert", operation: "insert", table, church_id: churchId });
      toast({
        title: "Unable to save",
        description: getUserFriendlyErrorMessage(err, "The record could not be saved. Please try again."),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for church-scoped mutations (update).
 */
export function useChurchUpdate(table: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Record<string, any> & { id: string }) => {
      const { data: result, error } = await supabase
        .from(table as any)
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`church-${table}`] });
    },
    onError: (err: any) => {
      logSupabaseError(err, { function: "useChurchUpdate", operation: "update", table });
      toast({
        title: "Unable to update",
        description: getUserFriendlyErrorMessage(err, "The record could not be updated. Please try again."),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for church-scoped delete.
 */
export function useChurchDelete(table: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`church-${table}`] });
    },
    onError: (err: any) => {
      logSupabaseError(err, { function: "useChurchDelete", operation: "delete", table });
      toast({
        title: "Unable to delete",
        description: getUserFriendlyErrorMessage(err, "The record could not be deleted. Please try again."),
        variant: "destructive",
      });
    },
  });
}
