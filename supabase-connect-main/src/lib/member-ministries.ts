import { supabase } from "@/integrations/supabase/client";

export type MemberMinistry = {
  id: string;
  churchId: string;
  name: string;
  description: string | null;
  memberCount: number;
  joined: boolean;
  requestPending: boolean;
};

type MinistryRow = { id: string; church_id: string; name: string; description: string | null };
type MembershipRow = { member_id: string; ministry_id: string };
type RequestRow = { ministry_id: string; status: string };

// The ministry portal tables predate the current generated client types.
// Keep the untyped boundary isolated while returning a narrow production model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const memberMinistriesQueryKey = (churchId?: string | null, memberId?: string | null) =>
  ["production-member-ministries", churchId, memberId] as const;

export async function fetchMemberMinistries(churchId: string, memberId: string): Promise<MemberMinistry[]> {
  const ministriesResult = await db
    .from("ministries")
    .select("id,church_id,name,description")
    .eq("church_id", churchId)
    .order("name");
  if (ministriesResult.error) throw ministriesResult.error;

  const ministries = (ministriesResult.data ?? []) as MinistryRow[];
  const ministryIds = ministries.map(({ id }) => id);
  if (!ministryIds.length) return [];

  const [membershipsResult, requestsResult] = await Promise.all([
    db.from("member_ministries").select("member_id,ministry_id").in("ministry_id", ministryIds),
    db
      .from("ministry_join_requests")
      .select("ministry_id,status")
      .eq("church_id", churchId)
      .eq("member_id", memberId)
      .eq("status", "pending"),
  ]);
  if (membershipsResult.error) throw membershipsResult.error;
  if (requestsResult.error) throw requestsResult.error;

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const requests = (requestsResult.data ?? []) as RequestRow[];

  return ministries.map((ministry) => ({
    id: ministry.id,
    churchId: ministry.church_id,
    name: ministry.name,
    description: ministry.description,
    memberCount: memberships.filter(({ ministry_id }) => ministry_id === ministry.id).length,
    joined: memberships.some(({ ministry_id, member_id }) => ministry_id === ministry.id && member_id === memberId),
    requestPending: requests.some(({ ministry_id }) => ministry_id === ministry.id),
  }));
}

export async function requestMinistryMembership(churchId: string, memberId: string, ministryId: string) {
  const { error } = await db.from("ministry_join_requests").insert({
    church_id: churchId,
    member_id: memberId,
    ministry_id: ministryId,
    status: "pending",
  });
  if (error) throw error;
}

export async function leaveMemberMinistry(memberId: string, ministryId: string) {
  const { error } = await db
    .from("member_ministries")
    .delete()
    .eq("member_id", memberId)
    .eq("ministry_id", ministryId);
  if (error) throw error;
}
