import { fetchMemberContributionTotal } from "@/lib/member-contributions";

export type MemberAssistantIntent =
  | "contribution_summary"
  | "contribution_history"
  | "contribute"
  | "mass_intentions"
  | "mass_schedule"
  | "announcements"
  | "prayers"
  | "reflections"
  | "bible"
  | "daily_readings"
  | "calendar"
  | "saints"
  | "radio"
  | "live_mass"
  | "parish_information"
  | "unknown";

export type MemberAssistantMatchClass = "exact" | "keyword" | "fallback";

export type MemberAssistantResolution = {
  intent: MemberAssistantIntent;
  confidence: "high" | "medium" | "none";
  matchClass: MemberAssistantMatchClass;
  action: "navigate" | "read" | "unavailable" | "suggest";
  route: string | null;
  response: string;
  actionLabel?: string;
};

export type MemberAssistantCapabilities = {
  radioEnabled: boolean;
  liveMassAvailable: boolean;
};

export const MEMBER_ASSISTANT_FALLBACK = "Sijaelewa vizuri. Unaweza kuchagua moja ya huduma hapa chini.";

export function normalizeMemberQuestion(input: string) {
  return input
    .toLocaleLowerCase("sw")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

function navigation(
  intent: MemberAssistantIntent,
  route: string,
  response: string,
  actionLabel: string,
): MemberAssistantResolution {
  return { intent, confidence: "high", matchClass: "keyword", action: "navigate", route, response, actionLabel };
}

export function resolveMemberAssistantIntent(
  input: string,
  capabilities: MemberAssistantCapabilities = { radioEnabled: false, liveMassAvailable: false },
): MemberAssistantResolution {
  const text = normalizeMemberQuestion(input);

  if (!text) return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };

  if (includesAny(text, ["jumla ya michango", "michango yangu ni kiasi", "nimechangia kiasi", "contribution total"])) {
    return { intent: "contribution_summary", confidence: "high", matchClass: "exact", action: "read", route: null, response: "Ninakagua jumla ya michango yako." };
  }
  if (includesAny(text, ["historia ya michango", "rekodi za michango", "risiti za michango", "nimechangia", "contribution history"])) {
    return navigation("contribution_history", "/portal/contribution-history", "Fungua historia yako ya michango na risiti.", "Angalia Historia");
  }
  if (
    text === "michango"
    || (text.includes("michango") && includesAny(text, ["nataka kuona", "naomba kuona", "onyesha michango yangu", "michango yangu", "nione michango"]))
  ) {
    return navigation("contribution_history", "/portal/contribution-history", "Fungua historia yako ya michango na risiti.", "Angalia Historia");
  }
  if (includesAny(text, ["nataka kuchangia", "toa mchango", "kutoa mchango", "weke mchango", "give contribution"])) {
    return navigation("contribute", "/portal/give", "Unaweza kufungua huduma ya kutoa mchango hapa.", "Toa Mchango");
  }
  if (includesAny(text, ["nia ya misa", "nia za misa", "kuweka nia", "mass intention"])) {
    return navigation("mass_intentions", "/portal/mass-intentions", "Unaweza kuweka au kufuatilia Nia ya Misa hapa.", "Nia za Misa");
  }
  if (includesAny(text, ["ratiba ya misa", "misa ya leo", "misa ya kesho", "misa jumapili", "mass schedule"])) {
    return navigation("mass_schedule", "/portal/calendar", "Angalia ratiba ya Misa ya parokia yako.", "Ratiba ya Misa");
  }
  if (includesAny(text, ["tangazo", "matangazo", "announcement"])) {
    return navigation("announcements", "/portal/announcements", "Soma matangazo yaliyochapishwa na parokia yako.", "Matangazo");
  }
  if (includesAny(text, ["tafakari", "reflection"])) {
    return navigation("reflections", "/portal/reflections", "Fungua tafakari za kiroho zilizochapishwa.", "Tafakari");
  }
  if (includesAny(text, ["masomo ya leo", "somo la leo", "injili ya leo", "daily readings"])) {
    return navigation("daily_readings", "/portal/daily-readings", "Soma masomo ya leo hapa.", "Masomo ya Leo");
  }
  if (includesAny(text, ["biblia", "bibilia", "bible"])) {
    return navigation("bible", "/portal/bible", "Fungua Biblia na uchague kitabu unachotaka kusoma.", "Biblia");
  }
  if (includesAny(text, ["sala", "maombi ya kanisa", "prayers"])) {
    return navigation("prayers", "/portal/prayers", "Fungua sala zilizochapishwa.", "Sala");
  }
  if (includesAny(text, ["watakatifu", "mtakatifu", "saints"])) {
    return navigation("saints", "/portal/library", "Jifunze maisha ya watakatifu hapa.", "Watakatifu");
  }
  if (includesAny(text, ["kalenda", "matukio ya parokia", "parish calendar"])) {
    return navigation("calendar", "/portal/calendar", "Fungua kalenda ya parokia yako.", "Kalenda");
  }
  if (includesAny(text, ["radio", "redio"])) {
    return capabilities.radioEnabled
      ? navigation("radio", "/portal/radio", "Radio ya parokia yako inapatikana.", "Fungua Radio")
      : { intent: "radio", confidence: "high", matchClass: "keyword", action: "unavailable", route: null, response: "Huduma ya Radio haipatikani kwa parokia yako kwa sasa." };
  }
  if (includesAny(text, ["misa live", "misa moja kwa moja", "live mass", "livestream"])) {
    return capabilities.liveMassAvailable
      ? navigation("live_mass", "/portal", "Misa ya moja kwa moja inapatikana kwenye ukurasa wako wa mwanzo.", "Angalia Misa Live")
      : { intent: "live_mass", confidence: "high", matchClass: "keyword", action: "unavailable", route: null, response: "Hakuna Misa ya moja kwa moja inayopatikana kwa sasa." };
  }
  if (includesAny(text, ["parokia yangu", "taarifa za kanisa", "kanisa langu", "church information"])) {
    return { intent: "parish_information", confidence: "medium", matchClass: "keyword", action: "suggest", route: null, response: "Taarifa za msingi za parokia yako zinaonekana kwenye ukurasa wako wa mwanzo." };
  }

  return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
}

export async function readOwnContributionSummary(churchId: string, memberId: string) {
  return fetchMemberContributionTotal(churchId, memberId);
}
