import { supabase } from "@/integrations/supabase/client";

export type MemberJumuiyaAssignment = {
  community_name: string;
  description: string | null;
};

export const memberJumuiyaAssignmentsQueryKey = (userId?: string | null, churchId?: string | null) =>
  ["member-jumuiya-assignments", userId ?? null, churchId ?? null] as const;

export async function fetchMyJumuiyaAssignments(): Promise<MemberJumuiyaAssignment[]> {
  const { data, error } = await supabase.rpc("get_my_jumuiya_assignments" as never);
  if (error) throw error;

  return ((data ?? []) as MemberJumuiyaAssignment[])
    .filter((assignment) => typeof assignment.community_name === "string" && assignment.community_name.trim().length > 0)
    .map((assignment) => ({
      community_name: assignment.community_name,
      description: typeof assignment.description === "string" ? assignment.description : null,
    }));
}
