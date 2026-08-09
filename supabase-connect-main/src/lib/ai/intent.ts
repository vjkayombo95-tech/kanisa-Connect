import type { KanisaAIIntent } from "./types";
import { looksLikeBibleReference } from "@/lib/bible-reference-parser";

function normalize(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s:,-]/gu, " ").replace(/\s+/g, " ").trim();
}

function hasAny(value: string, phrases: string[]) {
  return phrases.some((phrase) => value.includes(phrase));
}

export function classifyKanisaIntent(input: string): KanisaAIIntent {
  const text = normalize(input);
  if (!text) return "UNKNOWN";

  const asksForExplanation = hasAny(text, ["explain", "meaning", "interpret", "fafanua", "elezea"]);
  const scriptureTerms = ["gospel", "scripture", "bible", "verse", "reading", "injili", "neno", "biblia", "masomo"];

  if (asksForExplanation && hasAny(text, scriptureTerms)) return "AI_EXPLAIN_SCRIPTURE";
  if (hasAny(text, ["summarize", "summary", "recap", "muhtasari"])) return "AI_SUMMARIZE";
  if (hasAny(text, ["draft", "write", "compose", "prepare message", "tengeneza ujumbe"])) return "AI_DRAFT";

  if (hasAny(text, ["today's gospel", "today s gospel", "todays gospel", "today gospel", "daily reading", "daily readings", "today's readings", "today s readings", "todays readings", "liturgy", "masomo ya leo", "masomo ya dominika", "injili ya leo"])) {
    return "OPEN_DAILY_READINGS";
  }

  if (hasAny(text, ["my mass intentions", "mass intention", "mass intentions", "nia za misa"])) return "OPEN_MASS_INTENTIONS";
  if (hasAny(text, ["prayer request", "prayer requests", "maombi request", "maombi ya sala ambayo hayajashughulikiwa"])) return "OPEN_PRAYER_REQUESTS";
  if (hasAny(text, ["prayer for", "give me a prayer", "show me a prayer", "morning prayer", "evening prayer", "marian prayer", "family prayer", "healing prayer", "prayer related", "tafuta sala", "sala ya uponyaji", "sala ya amani", "nipatie sala"])) return "OPEN_PRAYER_LIBRARY";
  if (hasAny(text, ["maungamo", "confession", "reconciliation", "ubatizo", "baptism event", "baptism events", "ndoa", "marriage preparation", "wedding event", "misa inayofuata", "next mass", "what time is confession", "show youth activities"])) return "OPEN_CALENDAR";
  if (
    hasAny(text, [
      "sacrament",
      "sacraments",
      "baptism",
      "baptisms",
      "communion",
      "confirmation",
      "marriage certificate",
      "marriages scheduled",
      "funeral certificate",
      "funerals",
      "rcia",
      "catechumenate",
      "certificate number",
    ])
  ) {
    return "OPEN_SACRAMENTS";
  }
  if (hasAny(text, ["contribution", "contributions", "giving", "finance", "sadaka", "pledge", "receipt", "michango yangu", "mwenendo wa michango", "ahadi", "risiti"])) return "OPEN_CONTRIBUTIONS";
  if (hasAny(text, ["dashboard", "home", "workspace", "dashibodi", "nyumbani", "kazi za mfumo", "afya ya maudhui"])) return "SHOW_DASHBOARD";
  if (hasAny(text, ["upcoming events", "parish calendar", "calendar", "schedule", "ratiba", "what happens today", "what is on", "what's on", "masses tomorrow", "meetings this week", "sunday schedule", "matukio ya parokia", "kalenda ya parokia", "nia za misa zijazo"])) return "OPEN_CALENDAR";
  if (hasAny(text, ["events", "event", "matukio"])) return "OPEN_EVENTS";
  if (hasAny(text, ["saint", "saints", "mtakatifu", "watakatifu", "mtakatifu wa leo"])) return "OPEN_SAINT";

  const looksLikeReference = looksLikeBibleReference(input);
  if (hasAny(text, ["search scripture", "find verse", "bible search", "tafuta biblia", "tafuta mstari"]) || looksLikeReference) return "SEARCH_SCRIPTURE";
  if (hasAny(text, ["bible", "scripture", "biblia", "fungua biblia"])) return "OPEN_BIBLE";

  return "UNKNOWN";
}

export const supportedKanisaIntents: KanisaAIIntent[] = [
  "OPEN_BIBLE",
  "OPEN_DAILY_READINGS",
  "OPEN_SAINT",
  "OPEN_CALENDAR",
  "OPEN_EVENTS",
  "OPEN_MASS_INTENTIONS",
  "OPEN_PRAYER_REQUESTS",
  "OPEN_PRAYER_LIBRARY",
  "OPEN_SACRAMENTS",
  "OPEN_CONTRIBUTIONS",
  "SHOW_DASHBOARD",
  "SEARCH_SCRIPTURE",
  "AI_EXPLAIN_SCRIPTURE",
  "AI_SUMMARIZE",
  "AI_DRAFT",
  "UNKNOWN",
];
