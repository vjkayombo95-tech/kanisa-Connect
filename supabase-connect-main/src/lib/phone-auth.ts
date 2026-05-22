import { supabase } from "@/integrations/supabase/client";

export type NormalizedPhoneResult =
  | { valid: true; e164: string; national: string; local: string; digits: string }
  | { valid: false; error: string };

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeTanzanianPhone(value: string): NormalizedPhoneResult {
  const raw = value.trim();
  if (!raw) {
    return { valid: false, error: "Please enter a phone number." };
  }

  const compact = raw.replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;

  if (!/^\+?\d+$/.test(compact)) {
    return { valid: false, error: "Phone number can only contain digits, spaces, or +." };
  }

  let local = "";
  if (/^07\d{8}$/.test(digits)) {
    local = digits;
  } else if (/^2557\d{8}$/.test(digits)) {
    local = `0${digits.slice(3)}`;
  } else {
    return {
      valid: false,
      error: "Enter a valid Tanzanian number like 07XXXXXXXX, +2557XXXXXXXX, or 2557XXXXXXXX.",
    };
  }

  const national = `255${local.slice(1)}`;
  return {
    valid: true,
    e164: `+${national}`,
    national,
    local,
    digits: national,
  };
}

export function getTanzanianPhoneVariants(value: string) {
  const normalized = normalizeTanzanianPhone(value);
  if (!normalized.valid) return [];
  return Array.from(new Set([normalized.e164, normalized.national, normalized.local]));
}

export type PhoneAuthMember = {
  id: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  church_id: string | null;
  status: string | null;
};

export async function findMemberByTanzanianPhone(phone: string, churchId?: string | null) {
  const variants = getTanzanianPhoneVariants(phone);
  if (!variants.length) return null;

  let query = supabase
    .from("members")
    .select("id, email, phone, user_id, church_id, status")
    .in("phone", variants)
    .limit(2);

  if (churchId) {
    query = query.eq("church_id", churchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as PhoneAuthMember | null;
}

export async function resolveMemberEmailForPhoneLogin(phone: string) {
  const member = await findMemberByTanzanianPhone(phone);
  if (!member) {
    throw new Error("No member account was found with that phone number.");
  }

  const email = member.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("This phone number is registered, but it is not linked to an email login yet. Please contact your church office.");
  }

  return { email, member };
}

export async function assertPhoneIsAvailable(phone: string, churchId?: string | null) {
  const existingMember = await findMemberByTanzanianPhone(phone, churchId);
  if (existingMember) {
    throw new Error("That phone number is already registered. Please sign in or use another number.");
  }
}

export async function startTanzaniaPhoneOtp(_phone: string) {
  throw new Error("SMS OTP login is not enabled yet. Password login with phone lookup is currently supported.");
}
