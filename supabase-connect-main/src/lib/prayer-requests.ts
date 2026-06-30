import { supabase } from "@/integrations/supabase/client";

export type PrayerRequestStatus = "pending" | "approved" | "rejected";
export type PrayerRequestPrivacy = "public_to_church" | "private_to_pastor_admin" | "anonymous_public";

export type PrayerRequest = {
  id: string;
  member_id: string | null;
  request_text: string;
  status: PrayerRequestStatus;
  created_at: string;
  church_id: string | null;
  offering_amount: number | null;
  privacy: PrayerRequestPrivacy;
};

export type PrayerRequestInsert = {
  request_text: string;
  member_id: string;
  church_id: string;
  offering_amount?: number | null;
  status?: PrayerRequestStatus;
  privacy?: PrayerRequestPrivacy;
};

export type PrayerRequestWithMember = PrayerRequest & {
  members?: {
    full_name: string | null;
    email: string | null;
  } | null;
  member_name: string;
};

export const PRAYER_REQUEST_SELECT = `
  id,
  request_text,
  status,
  created_at,
  offering_amount,
  member_id,
  church_id,
  privacy,
  members(full_name, email)
`;

export function mapPrayerRequestRecord(row: PrayerRequestWithMember): PrayerRequestWithMember {
  return {
    ...row,
    member_name: row.members?.full_name ?? "Unknown",
  };
}

export async function submitPrayerRequest(payload: PrayerRequestInsert) {
  const request_text = payload.request_text.trim();
  const member_id = payload.member_id?.trim();
  const church_id = payload.church_id?.trim();

  if (!request_text) {
    throw new Error("Prayer request text is required.");
  }

  if (!member_id) {
    throw new Error("Member context is required.");
  }

  if (!church_id) {
    throw new Error("Church context is required.");
  }

  const { data, error } = await supabase
    .from("prayer_requests")
    .insert({
      request_text,
      member_id,
      church_id,
      offering_amount: payload.offering_amount ?? null,
      status: payload.status ?? "pending",
      privacy: payload.privacy ?? "public_to_church",
    })
    .select(PRAYER_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapPrayerRequestRecord(data as PrayerRequestWithMember);
}

export async function submitPortalPrayerRequest(payload: PrayerRequestInsert & {
  idempotency_key: string;
}) {
  const request_text = payload.request_text.trim();
  const member_id = payload.member_id?.trim();
  const church_id = payload.church_id?.trim();
  const idempotency_key = payload.idempotency_key?.trim();

  if (!request_text) {
    throw new Error("Prayer request text is required.");
  }

  if (!member_id) {
    throw new Error("Member context is required.");
  }

  if (!church_id) {
    throw new Error("Church context is required.");
  }

  if (!idempotency_key) {
    throw new Error("Submission key is required.");
  }

  const { data, error } = await supabase.rpc("submit_portal_prayer_request" as never, {
    p_church_id: church_id,
    p_member_id: member_id,
    p_request_text: request_text,
    p_offering_amount: payload.offering_amount ?? null,
    p_privacy: payload.privacy ?? "public_to_church",
    p_idempotency_key: idempotency_key,
  } as never);

  if (error) {
    throw error;
  }

  return data as { success: boolean; id: string; created: boolean };
}
