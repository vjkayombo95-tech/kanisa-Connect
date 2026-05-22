import { useQuery } from "@tanstack/react-query";

import { ChannelWorkspace } from "@/components/channels/ChannelWorkspace";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function ChannelsPage() {
  const { user, churchId } = useAuth();

  const { data: member } = useQuery({
    queryKey: ["chat-admin-member", user?.id, churchId],
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
      scope="church_admin"
      churchId={churchId}
      userId={user.id}
      memberId={member?.id ?? null}
      title="Church Channels"
      description="Create targeted channels for ministries, community leaders, or your administrative team."
    />
  );
}
