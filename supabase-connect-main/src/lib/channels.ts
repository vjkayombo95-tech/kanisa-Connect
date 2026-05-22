import { supabase } from "@/integrations/supabase/client";

export type ChannelAudienceType =
  | "ministry"
  | "community_leaders"
  | "all_community_leaders"
  | "admin_roles"
  | "community_members";

export interface ChannelRecipient {
  user_id: string;
  member_id: string | null;
}

export interface ChannelRecord {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  owner_scope: "church_admin" | "community_leader";
  audience_type: ChannelAudienceType;
  community_id: string | null;
  ministry_id: string | null;
  metadata: Record<string, any> | null;
  created_by: string;
  created_at: string;
}

function uniqueRecipients(rows: ChannelRecipient[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.user_id || seen.has(row.user_id)) return false;
    seen.add(row.user_id);
    return true;
  });
}

async function fetchMembersByIds(memberIds: string[]) {
  if (memberIds.length === 0) return [];
  const { data, error } = await supabase
    .from("members")
    .select("id, user_id")
    .in("id", memberIds);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; user_id: string | null }>;
}

export async function resolveChannelRecipients(params: {
  churchId: string;
  audienceType: ChannelAudienceType;
  ministryId?: string | null;
  communityId?: string | null;
  adminRoles?: string[];
}) {
  const { churchId, audienceType, ministryId, communityId, adminRoles = [] } = params;

  if (audienceType === "ministry") {
    if (!ministryId) throw new Error("Choose a ministry first.");

    const { data, error } = await supabase
      .from("member_ministries")
      .select("member_id")
      .eq("ministry_id", ministryId);

    if (error) throw error;
    const members = await fetchMembersByIds((data ?? []).map((row: any) => row.member_id));
    return uniqueRecipients(
      members.map((member) => ({
        user_id: member.user_id ?? "",
        member_id: member.id,
      })),
    );
  }

  if (audienceType === "community_members") {
    if (!communityId) throw new Error("Choose a community first.");

    const { data, error } = await supabase
      .from("member_communities")
      .select("member_id")
      .eq("community_id", communityId);

    if (error) throw error;

    const memberIds = new Set<string>((data ?? []).map((row: any) => row.member_id));

    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
      .eq("id", communityId)
      .maybeSingle();

    if (communityError) throw communityError;

    [
      community?.mwenyekiti_id,
      community?.makamu_mwenyekiti_id,
      community?.mweka_hazina_id,
      community?.katibu_id,
    ]
      .filter(Boolean)
      .forEach((memberId) => memberIds.add(memberId));

    const members = await fetchMembersByIds(Array.from(memberIds));
    return uniqueRecipients(
      members.map((member) => ({
        user_id: member.user_id ?? "",
        member_id: member.id,
      })),
    );
  }

  if (audienceType === "community_leaders" || audienceType === "all_community_leaders") {
    let query = supabase
      .from("communities")
      .select("id, mwenyekiti_id, makamu_mwenyekiti_id, mweka_hazina_id, katibu_id")
      .eq("church_id", churchId);

    if (audienceType === "community_leaders") {
      if (!communityId) throw new Error("Choose a community first.");
      query = query.eq("id", communityId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const memberIds = new Set<string>();
    (data ?? []).forEach((community: any) => {
      [
        community.mwenyekiti_id,
        community.makamu_mwenyekiti_id,
        community.mweka_hazina_id,
        community.katibu_id,
      ]
        .filter(Boolean)
        .forEach((memberId) => memberIds.add(memberId));
    });

    const members = await fetchMembersByIds(Array.from(memberIds));
    return uniqueRecipients(
      members.map((member) => ({
        user_id: member.user_id ?? "",
        member_id: member.id,
      })),
    );
  }

  if (audienceType === "admin_roles") {
    if (adminRoles.length === 0) throw new Error("Choose at least one administrative role.");

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("church_id", churchId)
      .in("role", adminRoles as any);

    if (error) throw error;

    const userIds = [...new Set((roles ?? []).map((row: any) => row.user_id).filter(Boolean))];
    if (userIds.length === 0) return [];

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("church_id", churchId)
      .in("user_id", userIds);

    if (membersError) throw membersError;

    const memberByUserId = new Map<string, string>();
    (members ?? []).forEach((member: any) => {
      if (member.user_id) memberByUserId.set(member.user_id, member.id);
    });

    return uniqueRecipients(
      userIds.map((userId) => ({
        user_id: userId,
        member_id: memberByUserId.get(userId) ?? null,
      })),
    );
  }

  return [];
}

export function getChannelAudienceLabel(channel: Partial<ChannelRecord>) {
  switch (channel.audience_type) {
    case "ministry":
      return "Ministry";
    case "community_leaders":
      return "Community Leaders";
    case "all_community_leaders":
      return "All Community Leaders";
    case "admin_roles":
      return "Administrative Team";
    case "community_members":
      return "Community Members";
    default:
      return "Channel";
  }
}
