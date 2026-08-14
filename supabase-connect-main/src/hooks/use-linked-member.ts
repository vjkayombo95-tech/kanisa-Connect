import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type LinkedMember = {
  id: string;
  full_name: string | null;
  church_id: string;
};

export function useLinkedMember() {
  const { user, churchId } = useAuth();

  return useQuery({
    queryKey: ["my-member-record", user?.id, user?.email, churchId],
    queryFn: async (): Promise<LinkedMember | null> => {
      if (!user || !churchId) return null;

      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("members")
        .select("id, full_name, church_id")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();

      if (linkedMemberError) throw linkedMemberError;
      if (linkedMember) return linkedMember;

      const email = user.email?.trim().toLowerCase();
      if (!email) return null;

      const { data: emailMember, error: emailMemberError } = await supabase
        .from("members")
        .select("id, full_name, church_id")
        .ilike("email", email)
        .eq("church_id", churchId)
        .maybeSingle();

      if (emailMemberError) throw emailMemberError;
      return emailMember;
    },
    enabled: !!user && !!churchId,
  });
}
