import { supabase } from "@/integrations/supabase/client";

export type MassIntentionStatus = "pending" | "approved" | "rejected";
export type CommunityHelpStatus = "pending" | "approved" | "rejected";

export type MassIntention = {
  id: string;
  member_id: string | null;
  intention_type: string;
  message: string;
  offering_amount: number | null;
  status: MassIntentionStatus;
  created_at: string;
  church_id: string | null;
};

export type CommunityHelpRequest = {
  id: string;
  member_id: string | null;
  category: string;
  description: string;
  target_amount: number | null;
  current_amount?: number;
  status: CommunityHelpStatus;
  created_at: string;
  church_id: string | null;
};

type MemberJoin = {
  members?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export type MassIntentionWithMember = MassIntention & MemberJoin & {
  member_name: string;
};

export type CommunityHelpRequestWithMember = CommunityHelpRequest & MemberJoin & {
  current_amount?: number;
  member_name: string;
};

export const MASS_INTENTION_SELECT = `
  id,
  message,
  intention_type,
  offering_amount,
  status,
  created_at,
  member_id,
  church_id,
  members(full_name, email)
`;

export const COMMUNITY_HELP_SELECT = `
  id,
  category,
  description,
  target_amount,
  current_amount,
  status,
  created_at,
  member_id,
  church_id
`;

export function mapMassIntentionRecord(row: MassIntentionWithMember): MassIntentionWithMember {
  return {
    ...row,
    member_name: row.members?.full_name ?? "Unknown",
  };
}

export function mapCommunityHelpRecord(row: CommunityHelpRequestWithMember): CommunityHelpRequestWithMember {
  return {
    ...row,
    member_name: row.members?.full_name ?? "Unknown",
  };
}

export async function enrichCommunityHelpRequests(rows: CommunityHelpRequest[]): Promise<CommunityHelpRequestWithMember[]> {
  const memberIds = Array.from(
    new Set(rows.map((row) => row.member_id).filter((value): value is string => Boolean(value))),
  );

  let membersById = new Map<string, { full_name: string | null; email: string | null }>();

  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from("members")
      .select("id, full_name, email")
      .in("id", memberIds);

    if (error) {
      throw error;
    }

    membersById = new Map(
      (data ?? []).map((member: any) => [
        member.id,
        { full_name: member.full_name ?? null, email: member.email ?? null },
      ]),
    );
  }

  return rows.map((row) =>
    mapCommunityHelpRecord({
      ...row,
      members: row.member_id ? membersById.get(row.member_id) ?? null : null,
    } as CommunityHelpRequestWithMember),
  );
}

export async function submitMassIntention(payload: {
  intention_type: string;
  message: string;
  offering_amount: number | null;
  member_id: string;
  church_id: string;
  requested_mass_date?: string | null;
  status?: MassIntentionStatus;
}) {
  const message = payload.message.trim();
  const member_id = payload.member_id?.trim();
  const church_id = payload.church_id?.trim();

  if (!message) {
    throw new Error("Message is required.");
  }

  if (!member_id || !church_id) {
    throw new Error("Member and church context are required.");
  }

  const { data, error } = await supabase
    .from("mass_intentions")
    .insert({
      intention_type: payload.intention_type,
      message,
      offering_amount: payload.offering_amount ?? null,
      member_id,
      church_id,
      status: payload.status ?? "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function submitCommunityHelpRequest(payload: {
  category: string;
  description: string;
  target_amount: number | null;
  member_id: string;
  church_id: string;
  status?: CommunityHelpStatus;
}) {
  const description = payload.description.trim();
  const member_id = payload.member_id?.trim();
  const church_id = payload.church_id?.trim();

  if (!description) {
    throw new Error("Description is required.");
  }

  if (!member_id || !church_id) {
    throw new Error("Member and church context are required.");
  }

  const { data, error } = await supabase
    .from("community_help_requests")
    .insert({
      category: payload.category,
      description,
      target_amount: payload.target_amount ?? null,
      member_id,
      church_id,
      status: payload.status ?? "pending",
    })
    .select(COMMUNITY_HELP_SELECT);

  if (error) {
    throw error;
  }

  if (!data?.length) {
    throw new Error("Help request was submitted but could not be read back.");
  }

  return (await enrichCommunityHelpRequests(data as CommunityHelpRequest[]))[0];
}
