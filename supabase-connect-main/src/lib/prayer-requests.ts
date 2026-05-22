import { supabase } from "@/integrations/supabase/client";

export type PrayerRequestStatus = "pending" | "approved" | "rejected";

export type PrayerRequest = {
  id: string;
  member_id: string | null;
  request_text: string;
  status: PrayerRequestStatus;
  created_at: string;
  church_id: string | null;
  offering_amount: number | null;
};

export type PrayerRequestInsert = {
  request_text: string;
  member_id: string;
  church_id: string;
  offering_amount?: number | null;
  status?: PrayerRequestStatus;
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
    })
    .select(PRAYER_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapPrayerRequestRecord(data as PrayerRequestWithMember);
}
