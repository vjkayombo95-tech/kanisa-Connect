import { useQuery } from "@tanstack/react-query";

import { ChannelWorkspace } from "@/components/channels/ChannelWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function PortalChannels() {
  const { user, churchId } = useAuth();

  const { data: member } = useQuery({
    queryKey: ["chat-portal-member", user?.id, churchId],
    queryFn: async () => {
      if (!user?.id || !churchId) return null;
      const { data, error } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("church_id", churchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!churchId,
  });

  if (!user?.id || !churchId) return null;

  return (
    <ChannelWorkspace
      scope="member"
      churchId={churchId}
      userId={user.id}
      memberId={member?.id ?? null}
      title="Channels"
      description="Stay aligned with ministry, community, and leadership updates in one place."
    />
  );
}
