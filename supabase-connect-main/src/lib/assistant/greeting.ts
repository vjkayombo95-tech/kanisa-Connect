import type { AssistantGreetingModel, PersonalAssistantContext } from "./types";

function timeGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function roleTitle(context: PersonalAssistantContext) {
  if (context.workspace === "pastoral") return "Father";
  if (context.workspace === "church_admin") return context.displayName || "Administrator";
  if (context.workspace === "finance") return context.displayName || "Treasurer";
  if (context.workspace === "super_admin") return context.displayName || "Admin";
  return context.displayName || "Member";
}

export function generateAssistantGreeting(context: PersonalAssistantContext): AssistantGreetingModel {
  const name = roleTitle(context);
  const salutation = `${timeGreeting(context.today)}, ${name}.`;
  const season = context.liturgicalSeason ? `${context.liturgicalSeason} season` : "today";
  const church = context.churchName ? ` at ${context.churchName}` : "";

  return {
    salutation,
    detail: `Here is your ${context.workspace.replace("_", " ")} briefing for ${season}${church}.`,
  };
}

