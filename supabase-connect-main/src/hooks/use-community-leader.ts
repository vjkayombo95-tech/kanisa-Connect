import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LedCommunity {
  community_id: string;
  community_name: string;
  leadership_role: string;
  church_id: string;
}

export function getCommunityContributionDate(contribution: any) {
  return contribution?.date ?? contribution?.created_at ?? null;
}

export function useLedCommunities() {
  const { user, churchId } = useAuth();
  return useQuery({
    queryKey: ["led-communities", user?.id, user?.email, churchId],
    queryFn: async () => {
      if (!user) return [];

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_led_communities" as never, {
        _user_id: user.id,
      } as never);

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        return (rpcData as any[]).map((community) => ({
          community_id: community.community_id,
          community_name: community.community_name,
          leadership_role: community.leadership_role,
          church_id: community.church_id,
        })) as LedCommunity[];
      }

      const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

      const { data: linkedMembers, error: linkedMemberError } = await supabase
        .from("members")
        .select("id, church_id, email")
        .eq("user_id", user.id)
        .not("church_id", "is", null);

      if (linkedMemberError) throw linkedMemberError;

      let emailMatchedMembers: Array<{ id: string; church_id: string | null; email: string | null }> = [];

      if (normalizedEmail) {
        let emailQuery = supabase
          .from("members")
          .select("id, church_id, email")
          .ilike("email", normalizedEmail)
          .not("church_id", "is", null);

        if (churchId) {
          emailQuery = emailQuery.eq("church_id", churchId);
        }

        const { data: emailMatches, error: emailMatchError } = await emailQuery;
        if (emailMatchError) throw emailMatchError;
        emailMatchedMembers = (emailMatches ?? []) as Array<{ id: string; church_id: string | null; email: string | null }>;
      }

      const memberMap = new Map<string, { id: string; church_id: string | null; email: string | null }>();
      [...(linkedMembers ?? []), ...emailMatchedMembers].forEach((member: any) => {
        if (member?.id) {
          memberMap.set(member.id, member);
        }
      });

      const members = Array.from(memberMap.values());
      if (!members.length) return [];

      const churchIds = [...new Set(members.map((member) => member.church_id).filter(Boolean))];
      const memberIds = new Set(members.map((member) => member.id));

      if (churchIds.length === 0) return [];

      const { data, error } = await supabase
        .from("communities")
        .select("id, name, church_id, leader_id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
        .in("church_id", churchIds);

      if (error) throw error;

      return ((data ?? []) as any[])
        .map((community) => {
          let leadershipRole: string | null = null;

          if ((community.mwenyekiti_id && memberIds.has(community.mwenyekiti_id)) || (community.leader_id && memberIds.has(community.leader_id))) {
            leadershipRole = "Mwenyekiti";
          }
          else if (community.makamu_mwenyekiti_id && memberIds.has(community.makamu_mwenyekiti_id)) leadershipRole = "Makamu Mwenyekiti";
          else if (community.mweka_hazina_id && memberIds.has(community.mweka_hazina_id)) leadershipRole = "Mweka Hazina";
          else if (community.katibu_id && memberIds.has(community.katibu_id)) leadershipRole = "Katibu";

          if (!leadershipRole) return null;

          return {
            community_id: community.id,
            community_name: community.name,
            leadership_role: leadershipRole,
            church_id: community.church_id,
          } satisfies LedCommunity;
        })
        .filter(Boolean) as LedCommunity[];
    },
    enabled: !!user,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityMembers(communityId: string, enabled = true) {
  return useQuery({
    queryKey: ["community-members", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_communities")
        .select("id, member_id, created_at, members:member_id(id, full_name, email, phone, photo_url, gender, status)")
        .eq("community_id", communityId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!communityId && enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityContributions(communityId: string) {
  return useQuery({
    queryKey: ["community-contributions", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*, members:member_id(full_name), contribution_categories:category_id(name)")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!communityId,
  });
}

export function useCommunityContributionRecords(communityId: string, limit?: number) {
  return useQuery({
    queryKey: ["community-contribution-records", communityId, limit ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("contributions")
        .select("id, member_id, category_id, donor_name, amount, date, created_at, notes")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false });

      if (typeof limit === "number") {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!communityId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityDetail(communityId: string) {
  return useQuery({
    queryKey: ["community-detail", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select(`
          *,
          chairperson:mwenyekiti_id(id, full_name, phone, photo_url),
          vice_chairperson:makamu_mwenyekiti_id(id, full_name, phone, photo_url),
          treasurer:mweka_hazina_id(id, full_name, phone, photo_url),
          katibu:katibu_id(id, full_name, phone, photo_url)
        `)
        .eq("id", communityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityMemberCount(communityId: string) {
  return useQuery({
    queryKey: ["community-member-count", communityId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("member_communities")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!communityId,
  });
}

export function useCommunityContributionSummary(communityId: string) {
  return useQuery({
    queryKey: ["community-contribution-summary", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("amount, date, created_at")
        .eq("community_id", communityId);
      if (error) throw error;

      return (data ?? []).map((contribution) => ({
        amount: Number(contribution.amount ?? 0),
        date: getCommunityContributionDate(contribution),
      }));
    },
    enabled: !!communityId,
  });
}

export function useRecentCommunityContributions(communityId: string, limit = 5) {
  return useQuery({
    queryKey: ["recent-community-contributions", communityId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, date, created_at, donor_name, members:member_id(full_name), contribution_categories:category_id(name)")
        .eq("community_id", communityId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!communityId,
  });
}

export function useCommunityPledgeSummary(communityId: string) {
  return useQuery({
    queryKey: ["community-pledge-summary", communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_targets")
        .select("total_pledged")
        .eq("community_id", communityId)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.total_pledged ?? 0);
    },
    enabled: !!communityId,
  });
}
