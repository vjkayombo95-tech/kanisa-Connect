import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PortalMemberRecord = {
  id: string;
  full_name: string | null;
  church_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

type FetchMemberForUserInput = {
  user: User | null | undefined;
  churchId: string | null | undefined;
  select?: string;
};

export async function fetchMemberForUser<TMember extends PortalMemberRecord = PortalMemberRecord>({
  user,
  churchId,
  select = "id, full_name, church_id, email, phone",
}: FetchMemberForUserInput): Promise<TMember | null> {
  if (!user || !churchId) return null;

  const { data: linkedMember, error: linkedMemberError } = await supabase
    .from("members")
    .select(select)
    .eq("user_id", user.id)
    .eq("church_id", churchId)
    .limit(1)
    .maybeSingle();

  if (linkedMemberError) throw linkedMemberError;
  if (linkedMember) return linkedMember as TMember;

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: emailMember, error: emailMemberError } = await supabase
    .from("members")
    .select(select)
    .ilike("email", normalizedEmail)
    .eq("church_id", churchId)
    .limit(1)
    .maybeSingle();

  if (emailMemberError) throw emailMemberError;
  return (emailMember ?? null) as TMember | null;
}

export function useMember<TMember extends PortalMemberRecord = PortalMemberRecord>(select?: string) {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: ["my-member-record", user?.id, user?.email, churchId, select ?? "default"],
    queryFn: () => fetchMemberForUser<TMember>({ user, churchId, select }),
    enabled: !!user && !!churchId,
    staleTime: 5 * 60 * 1000,
  });
}
