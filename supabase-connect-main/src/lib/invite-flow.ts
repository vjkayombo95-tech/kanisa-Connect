import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const INVITE_TABLES = ["invites", "invitations"] as const;

type InviteTableName = (typeof INVITE_TABLES)[number];
type ChurchRow = Pick<Tables<"churches">, "id" | "name">;
type MemberRow = Pick<Tables<"members">, "id" | "email" | "user_id" | "church_id" | "status">;

export type InviteRecord = {
  id: string;
  email: string;
  token: string;
  church_id: string;
  status: string;
  expires_at: string;
  invited_by?: string | null;
  created_at?: string;
  sourceTable: InviteTableName;
};

const normalizeInvite = (row: Record<string, unknown>, sourceTable: InviteTableName): InviteRecord => ({
  id: String(row.id ?? ""),
  email: String(row.email ?? ""),
  token: String(row.token ?? ""),
  church_id: String(row.church_id ?? ""),
  status: String(row.status ?? "pending"),
  expires_at: String(row.expires_at ?? ""),
  invited_by: typeof row.invited_by === "string" ? row.invited_by : null,
  created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  sourceTable,
});

const isMissingTableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Could not find the table") || message.includes("relation") || message.includes("schema cache");
};

export const isInvitePending = (invite: Pick<InviteRecord, "status" | "expires_at">) =>
  invite.status === "pending" && new Date(invite.expires_at).getTime() > Date.now();

export async function getInviteByToken(token: string) {
  for (const table of INVITE_TABLES) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (data) {
      return normalizeInvite(data as Record<string, unknown>, table);
    }

    if (error && !isMissingTableError(error)) {
      throw error;
    }
  }

  return null;
}

export async function getInviteChurch(churchId: string) {
  const { data, error } = await supabase
    .from("churches")
    .select("id, name")
    .eq("id", churchId)
    .maybeSingle();

  if (error) throw error;
  return (data as ChurchRow | null) ?? null;
}

export async function acceptInviteForUser(invite: InviteRecord, userId: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData.user;
  if (!user || user.id !== userId) {
    throw new Error("Authenticated user could not be resolved.");
  }

  const normalizedEmail = invite.email.trim().toLowerCase();
  const fallbackName = user.user_metadata?.full_name?.trim()
    || user.email?.split("@")[0]
    || "Member";

  console.log("USER:", user);
  console.log("CHURCH:", invite.church_id);

  const { data: existingLinkedMember, error: existingLinkedMemberError } = await supabase
    .from("members")
    .select("id, email, user_id, church_id, status")
    .eq("user_id", userId)
    .eq("church_id", invite.church_id)
    .maybeSingle();

  if (existingLinkedMemberError) throw existingLinkedMemberError;

  const linkedMember = existingLinkedMember as MemberRow | null;
  if (linkedMember && linkedMember.email?.toLowerCase() !== normalizedEmail) {
    throw new Error("Your account is already linked to another member in this church.");
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("id, email, user_id, church_id, status")
    .eq("email", normalizedEmail)
    .eq("church_id", invite.church_id)
    .maybeSingle();

  if (memberError) throw memberError;

  let member = (memberData as MemberRow | null) ?? linkedMember;

  if (member && member.user_id && member.user_id !== userId) {
    throw new Error("This invite has already been linked to another account.");
  }

  if (member) {
    const { error: updateMemberError } = await supabase
      .from("members")
      .update({
        user_id: userId,
        church_id: invite.church_id,
        status: "active",
      })
      .eq("id", member.id);

    if (updateMemberError) throw updateMemberError;
  } else {
    const memberInsert: TablesInsert<"members"> = {
      full_name: fallbackName,
      email: normalizedEmail,
      church_id: invite.church_id,
      user_id: userId,
      status: "active",
    };

    const { data: createdMember, error: createMemberError } = await supabase
      .from("members")
      .insert(memberInsert)
      .select("id, email, user_id, church_id, status")
      .single();

    if (createMemberError) throw createMemberError;
    member = createdMember as MemberRow;
  }

  console.log("MEMBER:", member);

  const { error: updateInviteError } = await supabase
    .from(invite.sourceTable as never)
    .update({ status: "accepted" })
    .eq("token", invite.token);

  if (updateInviteError) throw updateInviteError;

  const { error: assignRoleError } = await supabase.rpc("assign_default_member_role", {
    _user_id: userId,
    _church_id: invite.church_id,
  });
  if (assignRoleError) throw assignRoleError;

  const { error: updateAuthError } = await supabase.auth.updateUser({
    data: {
      church_id: invite.church_id,
    },
  });

  if (updateAuthError) {
    console.warn("Unable to store church_id in auth metadata:", updateAuthError.message);
  }

  const { error: refreshSessionError } = await supabase.auth.refreshSession();
  if (refreshSessionError) {
    console.warn("Unable to refresh session after invite acceptance:", refreshSessionError.message);
  }

  return member.id;
}
