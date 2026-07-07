import type { KanisaAIHandlerType, KanisaAIIntent } from "@/lib/ai";

export type CommandCenterResult = {
  id: string;
  title: string;
  subtitle: string;
  group: "Best match" | "Workspace" | "Pages" | "Scripture" | "Recent";
  route?: string;
  intent: KanisaAIIntent;
  requiresAI: boolean;
  handler: KanisaAIHandlerType;
  keywords: string[];
};

export type RecentCommand = {
  id: string;
  title: string;
  route?: string;
  intent: KanisaAIIntent;
  uses: number;
  lastUsedAt: number;
};
