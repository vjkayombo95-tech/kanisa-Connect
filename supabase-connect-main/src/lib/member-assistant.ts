export type MemberAssistantIntent =
  | "contributions"
  | "mass_intention"
  | "mass_schedule"
  | "announcements"
  | "prayer_request"
  | "daily_readings"
  | "unknown";

export type MemberAssistantResolution = {
  intent: MemberAssistantIntent;
  message: string;
  action?: { label: string; to: string };
};

function normalizeMemberQuestion(input: string) {
  return input.toLocaleLowerCase("sw").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function includesAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

export function resolveMemberAssistantIntent(input: string): MemberAssistantResolution {
  const text = normalizeMemberQuestion(input);

  if (includesAny(text, ["nia ya misa", "nia za misa", "kuweka nia", "misa kwa marehemu", "sadaka ya misa", "mass intention"])) {
    return { intent: "mass_intention", message: "Naweza kukusaidia kuweka Nia ya Misa.", action: { label: "Endelea", to: "/portal/mass-intentions" } };
  }

  if (includesAny(text, ["mchango", "michango", "nimechangia", "salio", "nimebakiza", "malipo yangu"])) {
    return { intent: "contributions", message: "Naweza kukuonyesha taarifa za michango yako.", action: { label: "Fungua Michango", to: "/portal/contribution-history" } };
  }

  if (includesAny(text, ["ratiba ya misa", "misa ya leo", "misa ya kesho", "misa jumapili", "mass schedule", "misa"])) {
    return { intent: "mass_schedule", message: "Unaweza kuona ratiba ya Misa ya parokia yako hapa.", action: { label: "Angalia Ratiba", to: "/portal/calendar" } };
  }

  if (includesAny(text, ["tangazo", "matangazo", "taarifa", "announcement"])) {
    return { intent: "announcements", message: "Haya ndiyo matangazo ya parokia yako.", action: { label: "Angalia Matangazo", to: "/portal/announcements" } };
  }

  if (includesAny(text, ["ombi la maombi", "maombi", "niombee", "prayer request"])) {
    return { intent: "prayer_request", message: "Unaweza kutuma ombi lako la maombi hapa.", action: { label: "Tuma Ombi", to: "/portal/prayer-requests" } };
  }

  if (includesAny(text, ["masomo ya leo", "somo la leo", "masomo", "injili", "gospel"])) {
    return { intent: "daily_readings", message: "Unaweza kusoma masomo ya leo hapa.", action: { label: "Soma Masomo", to: "/portal/today" } };
  }

  return {
    intent: "unknown",
    message: "Samahani, bado sijalielewa swali hilo vizuri.\n\nKwa sasa naweza kukusaidia kuhusu michango, Nia ya Misa, ratiba ya Misa, matangazo, maombi na huduma nyingine za parokia.",
  };
}
