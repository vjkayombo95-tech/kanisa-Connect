import { fetchMemberContributionTotalForRange, type MemberContributionRange } from "@/lib/member-contributions";

export type { MemberContributionRange };

export type MemberAssistantIntent =
  | "own_contributions"
  | "contribution_summary"
  | "contribution_history"
  | "contribute"
  | "next_mass"
  | "latest_announcement"
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
  contributionRange?: MemberContributionRange;
  massIntentionsMode?: "status";
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

function ownContribution(range: MemberContributionRange, response: string): MemberAssistantResolution {
  return {
    intent: "own_contributions",
    confidence: "high",
    matchClass: "exact",
    action: "read",
    route: null,
    response,
    contributionRange: range,
  };
}

function isBlockedContributionLookup(text: string) {
  return includesAny(text, [
    "michango ya wanachama wote",
    "mapato ya wanachama wote",
    "michango ya watu wote",
    "top contributors",
    "inactive contributors",
    "ripoti ya fedha",
    "ripoti ya michango ya kanisa",
    "contribution report pdf",
    "download contribution report",
    "michango ya member",
    "mchango wa member",
    "member ",
    "member-",
    "michango yangu ya ",
    "nimechangia kiasi gani member",
  ]);
}

function resolveOwnContributionRange(text: string): MemberContributionRange | null {
  if (isBlockedContributionLookup(text)) {
    return null;
  }

  const asksOwnContributions = includesAny(text, [
    "michango yangu",
    "nimechangia",
    "jumla ya michango yangu",
    "contribution total",
  ]);

  if (!asksOwnContributions) return null;

  if (text === "michango yangu") return "all_time";
  if (text.includes("leo")) return "today";
  if (text.includes("wiki hii")) return "this_week";
  if (text.includes("mwezi huu")) return "this_month";
  if (includesAny(text, ["jumla ya michango yangu", "nimechangia kiasi gani", "michango yangu ni kiasi", "contribution total"])) {
    return "all_time";
  }

  return null;
}

function isBlockedMassIntentionsLookup(text: string) {
  return includesAny(text, [
    "nia za misa za ",
    "nia zangu za misa za ",
    "nia yangu ya misa ya ",
    "nia za member",
    "nia zangu za member",
    "member foreign",
    "member-",
    "nia zote za kanisa",
    "nia za wanachama wote",
    "nia zilizokataliwa za watu wote",
  ]);
}

function isOwnMassIntentionsStatusQuestion(text: string) {
  return (
    includesAny(text, ["nia zangu", "nia yangu", "nina nia"])
    && includesAny(text, ["zikoje", "imekubaliwa", "hali gani", "zinazosubiri", "hali ya nia", "status"])
  );
}

export function resolveMemberAssistantIntent(
  input: string,
  capabilities: MemberAssistantCapabilities = { radioEnabled: false, liveMassAvailable: false },
): MemberAssistantResolution {
  const text = normalizeMemberQuestion(input);

  if (!text) return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };

  if (text === "jumla ya michango yangu") {
    return { intent: "contribution_summary", confidence: "high", matchClass: "exact", action: "read", route: null, response: "Ninakagua jumla ya michango yako." };
  }

  if (isBlockedContributionLookup(text)) {
    return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
  }

  const ownContributionRange = resolveOwnContributionRange(text);
  if (ownContributionRange === "today") {
    return ownContribution("today", "Ninakagua michango yako ya leo.");
  }
  if (ownContributionRange === "this_week") {
    return ownContribution("this_week", "Ninakagua michango yako ya wiki hii.");
  }
  if (ownContributionRange === "this_month") {
    return ownContribution("this_month", "Ninakagua michango yako ya mwezi huu.");
  }
  if (ownContributionRange === "all_time") {
    return ownContribution("all_time", "Ninakagua jumla ya michango yako.");
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
  if (isBlockedMassIntentionsLookup(text)) {
    return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
  }
  if (includesAny(text, ["nataka kuweka nia", "niweke nia", "kuweka nia"])) {
    return navigation("mass_intentions", "/portal/mass-intentions", "Unaweza kuweka au kufuatilia Nia ya Misa hapa.", "Nia za Misa");
  }
  if (isOwnMassIntentionsStatusQuestion(text)) {
    return { intent: "mass_intentions", confidence: "high", matchClass: "exact", action: "read", route: null, response: "Ninakagua hali ya Nia zako za Misa.", massIntentionsMode: "status" };
  }
  if (includesAny(text, ["nia ya misa", "nia yangu ya misa", "nia za misa", "mass intention"])) {
    return navigation("mass_intentions", "/portal/mass-intentions", "Unaweza kuweka au kufuatilia Nia ya Misa hapa.", "Nia za Misa");
  }
  if (includesAny(text, ["misa ijayo", "misa inayofuata"])) {
    if (includesAny(text, [" ya church ", " ya kanisa ", " ya parokia ", " ya parish ", "church ", "parish nyingine", "parokia nyingine", "kanisa lingine"])) {
      return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
    }
    return { intent: "next_mass", confidence: "high", matchClass: "exact", action: "read", route: null, response: "Ninakagua Misa ijayo kwenye ratiba ya parokia." };
  }
  if (includesAny(text, ["ratiba ya misa", "misa ya leo", "misa ya kesho", "misa jumapili", "mass schedule"])) {
    return navigation("mass_schedule", "/portal/calendar", "Angalia ratiba ya Misa ya parokia yako.", "Ratiba ya Misa");
  }
  if (includesAny(text, ["kuna tangazo jipya", "tangazo la mwisho", "tangazo la hivi karibuni", "nionyeshe tangazo la mwisho", "matangazo mapya yapo"])) {
    if (includesAny(text, [" la church ", " la kanisa ", " la parokia ", " la parish ", "church ", "parish nyingine", "parokia nyingine", "kanisa lingine"])) {
      return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
    }
    return { intent: "latest_announcement", confidence: "high", matchClass: "exact", action: "read", route: null, response: "Ninakagua tangazo la hivi karibuni la parokia." };
  }
  if (includesAny(text, ["tangazo", "matangazo", "announcement"])) {
    if (includesAny(text, [" la church ", " la kanisa ", " la parokia ", " la parish ", "church ", "parish nyingine", "parokia nyingine", "kanisa lingine"])) {
      return { intent: "unknown", confidence: "none", matchClass: "fallback", action: "suggest", route: null, response: MEMBER_ASSISTANT_FALLBACK };
    }
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
  return fetchMemberContributionTotalForRange(churchId, memberId, "all_time");
}
