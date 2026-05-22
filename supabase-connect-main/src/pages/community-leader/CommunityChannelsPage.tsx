import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";

import { ChannelWorkspace } from "@/components/channels/ChannelWorkspace";
import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function CommunityChannelsPage() {
  const { communityId, community, churchId } = useOutletContext<CommunityOutletContext>();
  const { user } = useAuth();

  const { data: member, isLoading, error } = useQuery({
    queryKey: ["chat-community-member", user?.id, churchId],
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

  if (!user?.id || !churchId || isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive/70" />
          <p className="text-sm font-medium">We could not load your community channel access.</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Please refresh and try again."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChannelWorkspace
      scope="community_leader"
      churchId={churchId}
      userId={user.id}
      memberId={member?.id ?? null}
      communityId={communityId}
      title="Community Channels"
      description={`Share updates, reports, and discussion threads for ${community?.name || "this community"}.`}
    />
  );
}
