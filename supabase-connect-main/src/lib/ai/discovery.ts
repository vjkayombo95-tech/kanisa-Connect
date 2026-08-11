import type { ControlledKanisaAIIntent } from "./controlled-answers";
import { isAuthorizedControlledIntent } from "./controlled-answers";
import { kanisaAIActionRegistry } from "./registry";
import type { KanisaAIContext, KanisaAIDiscoveryCategory, KanisaAIDiscoveryQuestion } from "./types";

export const discoveryCategoryLabels: Record<KanisaAIDiscoveryCategory, { en: string; sw: string }> = {
  finance: { en: "Finance", sw: "Michango na Fedha" },
  members: { en: "Members", sw: "Wanachama" },
  operations: { en: "Operations", sw: "Uendeshaji" },
  pastoral: { en: "Pastoral", sw: "Kichungaji" },
  live: { en: "Live", sw: "Live na Radio" },
};

export type ResolvedDiscoveryQuestion = KanisaAIDiscoveryQuestion & { intent: ControlledKanisaAIIntent; label: string };

export function resolveKanisaAIDiscovery(context: KanisaAIContext, language: "en" | "sw" = "en") {
  if (!context.church.id || context.workspace === "super_admin") return [];
  return kanisaAIActionRegistry.flatMap((action) => (action.discovery ?? []).map((item) => ({ ...item, intent: action.intent as ControlledKanisaAIIntent, label: language === "sw" ? item.labelSw : item.labelEn })))
    .filter((item) => isAuthorizedControlledIntent(item.intent, context))
    .filter((item) => !(context.role === "member" && item.intent === "ATTENTION_SUMMARY"))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function groupKanisaAIDiscovery(items: ResolvedDiscoveryQuestion[]) {
  return (["finance", "members", "operations", "pastoral", "live"] as KanisaAIDiscoveryCategory[])
    .map((category) => ({ category, items: items.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0);
}
