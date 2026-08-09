import { supabase } from "@/integrations/supabase/client";

export type Ministry = {
  id: string;
  church_id: string | null;
  name: string | null;
  description: string | null;
  created_at: string | null;
};

export type MinistryMembership = {
  id: string;
  member_id: string;
  ministry_id: string;
  created_at: string | null;
};

export type MinistrySummary = Ministry & {
  memberCount: number;
  isMember: boolean;
  joinedAt: string | null;
  requestStatus: string | null;
  requestId: string | null;
};

export type MinistryJoinRequest = {
  id: string;
  church_id: string;
  ministry_id: string;
  member_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  members?: { full_name: string | null; email: string | null; phone: string | null } | null;
  ministries?: { name: string | null } | null;
};

export function getMinistriesQueryKey(churchId: string | null | undefined) {
  return ["ministries", churchId] as const;
}

export function getMinistryMembershipsQueryKey(churchId: string | null | undefined) {
  return ["ministry-members-all", churchId] as const;
}

export function getMyMinistriesQueryKey(memberId: string | null | undefined, churchId: string | null | undefined) {
  return ["my-ministries", memberId, churchId] as const;
}

export function getMinistryJoinRequestsQueryKey(churchId: string | null | undefined) {
  return ["ministry-join-requests", churchId] as const;
}

export async function fetchMinistries(churchId: string | null | undefined): Promise<Ministry[]> {
  if (!churchId) return [];

  const { data, error } = await supabase
    .from("ministries")
    .select("id, church_id, name, description, created_at")
    .eq("church_id", churchId)
    .order("name");

  if (error) throw error;
  return (data ?? []) as Ministry[];
}

export async function fetchMinistryMemberships(churchId: string | null | undefined): Promise<MinistryMembership[]> {
  if (!churchId) return [];

  const ministries = await fetchMinistries(churchId);
  const ministryIds = ministries.map((ministry) => ministry.id);
  if (ministryIds.length === 0) return [];

  const { data, error } = await supabase
    .from("member_ministries")
    .select("id, member_id, ministry_id, created_at")
    .in("ministry_id", ministryIds);

  if (error) throw error;
  return (data ?? []) as MinistryMembership[];
}

export async function fetchMinistrySummaries({
  churchId,
  memberId,
}: {
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}): Promise<MinistrySummary[]> {
  const [ministries, memberships, requests] = await Promise.all([
    fetchMinistries(churchId),
    fetchMinistryMemberships(churchId),
    fetchMyMinistryJoinRequests({ churchId, memberId }),
  ]);

  return ministries.map((ministry) => {
    const ministryMemberships = memberships.filter((membership) => membership.ministry_id === ministry.id);
    const myMembership = memberId
      ? ministryMemberships.find((membership) => membership.member_id === memberId)
      : null;
    const myRequest = requests.find((request) => request.ministry_id === ministry.id && request.status === "pending");

    return {
      ...ministry,
      memberCount: ministryMemberships.length,
      isMember: Boolean(myMembership),
      joinedAt: myMembership?.created_at ?? null,
      requestStatus: myRequest?.status ?? null,
      requestId: myRequest?.id ?? null,
    };
  });
}

export async function fetchMyMinistryJoinRequests({
  churchId,
  memberId,
}: {
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}): Promise<MinistryJoinRequest[]> {
  if (!churchId || !memberId) return [];

  const { data, error } = await supabase
    .from("ministry_join_requests" as never)
    .select("*")
    .eq("church_id", churchId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MinistryJoinRequest[];
}

export async function fetchPendingMinistryJoinRequests(churchId: string | null | undefined): Promise<MinistryJoinRequest[]> {
  if (!churchId) return [];

  const { data, error } = await supabase
    .from("ministry_join_requests" as never)
    .select("*, members(full_name,email,phone), ministries(name)")
    .eq("church_id", churchId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MinistryJoinRequest[];
}

export async function requestToJoinMinistry({
  churchId,
  memberId,
  ministryId,
}: {
  churchId: string;
  memberId: string;
  ministryId: string;
}) {
  const { error } = await supabase
    .from("ministry_join_requests" as never)
    .insert({ church_id: churchId, member_id: memberId, ministry_id: ministryId, status: "pending" } as never);

  if (error) throw error;
}

export async function approveMinistryJoinRequest(request: MinistryJoinRequest, reviewedBy: string | null | undefined) {
  const { error: membershipError } = await supabase
    .from("member_ministries")
    .upsert(
      { member_id: request.member_id, ministry_id: request.ministry_id },
      { onConflict: "member_id,ministry_id" },
    );

  if (membershipError) throw membershipError;

  const { error } = await supabase
    .from("ministry_join_requests" as never)
    .update({
      status: "approved",
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", request.id);

  if (error) throw error;
}

export async function rejectMinistryJoinRequest(request: MinistryJoinRequest, reviewedBy: string | null | undefined) {
  const { error } = await supabase
    .from("ministry_join_requests" as never)
    .update({
      status: "rejected",
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", request.id);

  if (error) throw error;
}

export async function leaveMinistry({
  memberId,
  ministryId,
}: {
  memberId: string;
  ministryId: string;
}) {
  const { error } = await supabase
    .from("member_ministries")
    .delete()
    .eq("member_id", memberId)
    .eq("ministry_id", ministryId);

  if (error) throw error;
}
