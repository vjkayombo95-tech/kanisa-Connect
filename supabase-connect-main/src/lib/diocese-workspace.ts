import { supabase } from "@/integrations/supabase/client";
import type { DioceseStaffRole } from "@/lib/diocese-management";
import { logSupabaseError } from "@/lib/error-logger";

export type DioceseWorkspace = {
  diocese_id: string;
  diocese_name: string;
  diocese_slug: string;
  diocese_logo_url: string | null;
  diocese_cover_photo_url: string | null;
  staff_role: DioceseStaffRole;
  staff_membership_id: string;
};

export async function getMyDioceseWorkspaces(): Promise<DioceseWorkspace[]> {
  const { data, error } = await supabase.rpc(
    "get_my_diocese_workspaces" as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "getMyDioceseWorkspaces",
      operation: "rpc",
      rpc: "get_my_diocese_workspaces",
    });

    throw error;
  }

  return (data ?? []) as DioceseWorkspace[];
}

export function findDioceseWorkspace(
  workspaces: ReadonlyArray<DioceseWorkspace>,
  dioceseId: string | null | undefined,
) {
  if (!dioceseId) return null;

  return (
    workspaces.find((workspace) => workspace.diocese_id === dioceseId) ??
    null
  );
}

export type DioceseParish = {
  diocese_church_id: string;
  church_id: string;
  church_name: string;
  church_code: string | null;
  church_address: string | null;
  church_email: string | null;
  church_phone: string | null;
  church_logo_url: string | null;
  joined_at: string;
};

export async function getDioceseParishes(
  dioceseId: string,
): Promise<DioceseParish[]> {
  const { data, error } = await supabase.rpc(
    "get_diocese_parishes" as never,
    {
      _diocese_id: dioceseId,
    } as never,
  );

  if (error) {
    logSupabaseError(error, {
      function: "getDioceseParishes",
      operation: "rpc",
      rpc: "get_diocese_parishes",
    });

    throw error;
  }

  return (data ?? []) as DioceseParish[];
}
